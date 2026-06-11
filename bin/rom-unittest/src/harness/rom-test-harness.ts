import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROM_BASE, ROM_SIZE, ZP } from "../bbc/mos.js";
import {
  createJsbeebCpu,
  fillMemory,
  run6502,
  snapshotRegisters,
} from "../cpu/jsbeeb-cpu.js";
import type { CpuFactory, JsbeebCpu, RunOptions, RunResult } from "../cpu/types.js";
import { MosMock } from "../mos/mos-mock.js";
import {
  loadBeebAsmLabels,
  configureHookAddresses,
  rtcHookAddresses,
  serviceEntryAddress,
  type BeebAsmSymbols,
} from "../beebasm/labels.js";
import { RtcMock } from "../rtc/getrtc-stub.js";
import type { PartialRtcMockState, RtcMockState } from "../rtc/getrtc-stub.js";
import { NvramMock, installConfigureWorkspaceStubs } from "../nvram/nvram-mock.js";
import type { PartialNvramImage } from "../nvram/nvram-mock.js";
import { createDefaultConfigureNvramImage } from "../nvram/configure-defaults.js";
import { createBlankNvramImage } from "../nvram/defaults.js";
import { BLANK_RTC_MOCK_STATE } from "../rtc/defaults.js";
import { ReadKeySwitchesStub } from "../nvram/configure-stubs.js";
import {
  assertWorkspaceGuard,
  MOS_ERROR_PTR_ADDRESS,
  snapshotWorkspaceGuard,
  type WorkspaceGuardOptions,
  type WorkspaceSnapshot,
} from "./workspace-guard.js";

export interface I2CBeebRomHarnessOptions {
  /** Path to a sideways ROM image. */
  romPath: string;
  /** BeebAsm `-labels` file for this ROM (`-d -labels`). */
  labelsPath: string;
  romBase?: number;
  /** Byte used to initialise RAM outside the loaded ROM image. Default NOP ($EA). */
  ramFill?: number;
  cpuFactory?: CpuFactory;
  mos?: MosMock;
  /**
   * After each {@link invokeService} / {@link invokeCommand} / {@link invokeBoot},
   * assert zero page is unchanged except MOS star-command scratch `&A8–&AF` (#12).
   * Default true.
   */
  workspaceGuard?: boolean;
  /** Options when {@link workspaceGuard} is enabled (optional RAM regions, etc.). */
  workspaceGuardOptions?: WorkspaceGuardOptions;
}

export interface CommandCallOptions {
  /** Text after the * prefix, e.g. `TIME\\r`. */
  commandText: string;
  y?: number;
  commandLine?: number;
}

export interface ServiceCallOptions {
  /** MOS service type (A on entry), e.g. 9 = *HELP. */
  serviceType: number;
  x?: number;
  y?: number;
  /** Pointer to the parsed * command line (default $0900). */
  commandLine?: number;
  /** Command line text (default CR only for bare *HELP). */
  commandText?: string;
}

const RETURN_TRAMPOLINE = 0x0200;

/**
 * I2CBeeb sideways ROM (BBC / Electron / AP6 builds) at $8000 — real assembled binary
 * on jsbeeb's 6502 core with mocked MOS entry points.
 *
 * Includes *CONFIGURE / *STATUS when built with INC_CONFIG; stubs FRAM/RTC via labels.
 */
export class I2CBeebRomTestHarness {
  readonly cpu: JsbeebCpu;
  readonly mos: MosMock;
  readonly romBase: number;
  readonly rom: Uint8Array;
  readonly symbols: BeebAsmSymbols;
  readonly serviceEntry: number;
  readonly getrtcEntry: number;
  readonly writetdEntry: number;
  readonly wtbrkEntry: number;
  readonly framReadEntry: number | null;
  readonly framWriteEntry: number | null;
  readonly readKeySwitchesEntry: number | null;

  private readonly returnTrampoline = RETURN_TRAMPOLINE;
  private readonly rtcMock = new RtcMock();
  private readonly nvramMock = new NvramMock();
  private readonly readKeySwitchesStub = new ReadKeySwitchesStub();
  private rtcMockEnabled = false;
  private configureMockEnabled = false;
  private readonly workspaceGuardEnabled: boolean;
  private readonly workspaceGuardOptions: WorkspaceGuardOptions;

  constructor(options: I2CBeebRomHarnessOptions) {
    this.workspaceGuardEnabled = options.workspaceGuard !== false;
    this.workspaceGuardOptions = options.workspaceGuardOptions ?? {};
    this.romBase = options.romBase ?? ROM_BASE;
    this.rom = loadRomImage(options.romPath);
    this.symbols = loadBeebAsmLabels(options.labelsPath);
    const hooks = rtcHookAddresses(this.symbols);
    this.getrtcEntry = hooks.getrtc;
    this.writetdEntry = hooks.writetd;
    this.wtbrkEntry = hooks.wtbrk;
    const configureHooks = configureHookAddresses(this.symbols);
    this.framReadEntry = configureHooks.framReadByte;
    this.framWriteEntry = configureHooks.framWriteByte;
    this.readKeySwitchesEntry = configureHooks.readKeySwitches;
    this.serviceEntry = serviceEntryAddress(this.symbols);

    this.cpu = (options.cpuFactory ?? createJsbeebCpu)();
    this.mos = options.mos ?? new MosMock();
    this.resetMemory(options.ramFill ?? 0xea);
    this.mos.attach(this.cpu);
    this.installReturnTrampoline();
  }

  /** Re-fill RAM and re-load ROM; clears MOS capture buffers. */
  resetMemory(ramFill = 0xea): void {
    fillMemory(this.cpu, ramFill);
    this.loadRomIntoMemory();
    this.installReturnTrampoline();
    this.mos.reinstallStubs(this.cpu);
    this.mos.resetCaptures();
    this.reinstallRtcMock();
    this.reinstallConfigureMock();
    if (this.configureMockEnabled) {
      installConfigureWorkspaceStubs(this.cpu);
    }
    this.cpu.halted = false;
  }

  /** Enable a stateful RTC mock (getrtc read + writetd write + wtbrk write). */
  mockRtc(initial?: PartialRtcMockState): void {
    this.rtcMockEnabled = true;
    this.rtcMock.reset();
    if (initial) {
      this.rtcMock.setState(initial);
    }
    this.reinstallRtcMock();
  }

  /** Set RTC mock state (implies {@link mockRtc} when not yet enabled). */
  stubGetrtc(time: PartialRtcMockState): void {
    if (!this.rtcMockEnabled) {
      this.mockRtc(time);
      return;
    }
    this.rtcMock.setState(time);
    this.reinstallRtcMock();
  }

  /** Current RTC mock state (time/date BCD + Time-on-Break flag). */
  getRtcState(): RtcMockState {
    return { ...this.rtcMock.state };
  }

  /** Enable RTC mock with all-zero scratch (uninitialised chip buffer). */
  mockBlankRtc(): void {
    this.mockRtc(BLANK_RTC_MOCK_STATE);
  }

  /**
   * Enable NVRAM mock with a blank store (byte 255 = 0).
   * `SET_Startup` takes the `resetEverything` path on service 1 boot.
   */
  mockConfigureBlank(): void {
    if (this.framReadEntry === null || this.framWriteEntry === null) {
      return;
    }
    this.configureMockEnabled = true;
    this.nvramMock.loadImage(createBlankNvramImage());
    this.mos.stubOsbyteDefault(() => ({ a: 0, carry: false }));
    installConfigureWorkspaceStubs(this.cpu);
    this.reinstallConfigureMock();
  }

  /**
   * Stub MOS so `SET_Startup` sees the R key held (`OSBYTE &79`, key &B3).
   * Requires {@link mockConfigure} or {@link mockConfigureBlank} first.
   */
  mockRKeyPressed(): void {
    this.mos.stubOsbyte(0x79, ({ x }) => (x === 0xb3 ? { x: 0x80 } : {}));
    this.mos.stubOsbyte(0x78, () => ({}));
  }

  /**
   * Enable NVRAM + permissive OSBYTE stubs for configure (INC_CONFIG) builds.
   * No-op when the ROM has no FRAM_readByte / FRAM_writeByte symbols.
   */
  mockConfigure(initial?: PartialNvramImage): void {
    if (this.framReadEntry === null || this.framWriteEntry === null) {
      return;
    }
    this.configureMockEnabled = true;
    this.nvramMock.loadImage(createDefaultConfigureNvramImage(), initial);
    this.mos.stubOsbyteDefault(() => ({ a: 0, carry: false }));
    installConfigureWorkspaceStubs(this.cpu);
    this.reinstallConfigureMock();
  }

  /** Current NVRAM image (configure builds only). */
  getNvramImage(): Uint8Array {
    return new Uint8Array(this.nvramMock.image);
  }

  /** Invoke MOS service 1 — sideways ROM boot / Time-on-Break header. */
  invokeBoot(): RunResult {
    return this.invokeService({ serviceType: 1, commandText: "\r" });
  }

  /** Invoke MOS service 4 — unknown `*` command dispatch. */
  invokeCommand(options: CommandCallOptions): RunResult {
    return this.invokeService({
      serviceType: 4,
      commandText: options.commandText,
      y: options.y ?? 0,
      commandLine: options.commandLine,
    });
  }

  /** Invoke the sideways ROM service entry (JMP target from the ROM header). */
  invokeService(options: ServiceCallOptions): RunResult {
    const cmdAddr = options.commandLine ?? 0x0900;
    const text = options.commandText ?? "\r";
    writeCommandLine(this.cpu, cmdAddr, text);
    this.cpu.writemem(ZP.CLI, cmdAddr & 0xff);
    this.cpu.writemem(ZP.CLI + 1, (cmdAddr >> 8) & 0xff);

    let y = options.y;
    if (y === undefined) {
      y = Math.max(0, text.length - 1);
    }

    const workspaceSnapshot = this.snapshotWorkspaceIfEnabled();
    const errorPtrBefore = this.workspaceGuardEnabled
      ? ([
          this.readMemory(MOS_ERROR_PTR_ADDRESS),
          this.readMemory(MOS_ERROR_PTR_ADDRESS + 1),
        ] as const)
      : null;

    const result = this.run({
      pc: this.serviceEntry,
      a: options.serviceType & 0xff,
      x: options.x ?? 0,
      y,
      returnAddress: this.returnTrampoline,
      flags: { i: true },
    });
    this.assertWorkspaceIfEnabled(workspaceSnapshot, result, errorPtrBefore);
    return result;
  }

  /** Run from an arbitrary address (direct routine tests). */
  run(options: RunOptions): RunResult {
    const result = run6502(this.cpu, options);
    if (this.mos.unexpected.length > 0 && result.reason === "halted") {
      return {
        ...result,
        reason: "unexpected-mos",
        mosVector: this.mos.unexpected[this.mos.unexpected.length - 1],
      };
    }
    return result;
  }

  readMemory(address: number): number {
    return this.cpu.readmem(address & 0xffff);
  }

  writeMemory(address: number, value: number): void {
    this.cpu.writemem(address & 0xffff, value & 0xff);
  }

  writeWord(address: number, value: number): void {
    this.writeMemory(address, value & 0xff);
    this.writeMemory(address + 1, (value >> 8) & 0xff);
  }

  registers() {
    return snapshotRegisters(this.cpu);
  }

  private loadRomIntoMemory(): void {
    for (let i = 0; i < this.rom.length; i++) {
      this.cpu.writemem(this.romBase + i, this.rom[i]!);
    }
  }

  private installReturnTrampoline(): void {
    // NOP sled — the run loop stops when PC reaches here after RTS.
    this.cpu.writemem(this.returnTrampoline, 0xea);
  }

  private reinstallRtcMock(): void {
    this.rtcMock.detach(this.cpu);
    if (this.rtcMockEnabled) {
      this.rtcMock.install(this.cpu, this.getrtcEntry, this.writetdEntry, this.wtbrkEntry);
    }
  }

  private snapshotWorkspaceIfEnabled(): WorkspaceSnapshot | null {
    if (!this.workspaceGuardEnabled) {
      return null;
    }
    return snapshotWorkspaceGuard(
      (address) => this.readMemory(address),
      this.workspaceGuardOptions,
    );
  }

  private assertWorkspaceIfEnabled(
    snapshot: WorkspaceSnapshot | null,
    result?: RunResult,
    errorPtrBefore?: readonly [number, number] | null,
  ): void {
    if (snapshot === null) {
      return;
    }
    const read = (address: number) => this.readMemory(address);
    if (
      result?.reason === "brk" ||
      (errorPtrBefore !== null &&
        errorPtrBefore !== undefined &&
        (read(MOS_ERROR_PTR_ADDRESS) !== errorPtrBefore[0] ||
          read(MOS_ERROR_PTR_ADDRESS + 1) !== errorPtrBefore[1]))
    ) {
      return;
    }
    assertWorkspaceGuard(read, snapshot);
  }

  private reinstallConfigureMock(): void {
    this.nvramMock.detach(this.cpu);
    this.readKeySwitchesStub.detach(this.cpu);
    if (
      this.configureMockEnabled &&
      this.framReadEntry !== null &&
      this.framWriteEntry !== null
    ) {
      this.nvramMock.install(this.cpu, this.framReadEntry, this.framWriteEntry);
      if (this.readKeySwitchesEntry !== null) {
        this.readKeySwitchesStub.install(this.cpu, this.readKeySwitchesEntry);
      }
    }
  }
}

export function loadRomImage(romPath: string): Uint8Array {
  const abs = resolve(romPath);
  const data = readFileSync(abs);
  if (data.length > ROM_SIZE) {
    throw new Error(`ROM at ${abs} exceeds ${ROM_SIZE} bytes (${data.length})`);
  }
  if (data.length === ROM_SIZE) {
    return new Uint8Array(data);
  }
  // Unpadded images (e.g. EAP6 with PAD=0) — pad to a full 16 KiB sideways ROM map.
  const rom = new Uint8Array(ROM_SIZE);
  rom.fill(0xff);
  rom.set(data, 0);
  return rom;
}

export function parseServiceEntry(rom: Uint8Array, romBase = ROM_BASE): number {
  const rel = 0x8003 - romBase;
  if (rom[rel] !== 0x4c) {
    throw new Error(`ROM header at $8003 is not JMP absolute (found $${rom[rel]?.toString(16) ?? "??"})`);
  }
  return rom[rel + 1]! | (rom[rel + 2]! << 8);
}

export function writeCommandLine(cpu: JsbeebCpu, address: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    cpu.writemem(address + i, text.charCodeAt(i) & 0xff);
  }
}
