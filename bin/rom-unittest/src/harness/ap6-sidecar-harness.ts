import { ROM_BASE, ZP } from "../bbc/mos.js";
import { createJsbeebCpu, fillMemory, run6502, snapshotRegisters } from "../cpu/jsbeeb-cpu.js";
import type { CpuFactory, JsbeebCpu, RunResult } from "../cpu/types.js";
import { MosMock } from "../mos/mos-mock.js";
import { loadRomImage, parseServiceEntry } from "./rom-test-harness.js";

export const ROM_MANAGER_L0D6D = 0x0d6d;
/** MOS break type: 1 = power-on, 0 = Ctrl-Break (&0200 page). */
export const MOS_BREAK_TYPE = 0x028d;
/** MOS machine type at &FFB2 (&40 = Electron). */
export const MOS_MACHINE_TYPE = 0xffb2;
/** MOS current language ROM number (soft BREAK re-enters this). */
export const MOS_LANGUAGE_ROM_NUMBER = 0x028c;
/** MOS tube enable flag (0 = tube disabled). */
export const MOS_TUBE_ENABLE = 0x027a;
const ROM_ENABLE_BASE = 0x0df0;
export const ELECTRON_ROM_TABLE = 0x02a0;
export const RETURN_TRAMPOLINE = 0x0200;

export interface Ap6AmalgamModuleBinding {
  cpu: JsbeebCpu;
  mos: MosMock;
  rom: Uint8Array;
  romBase: number;
  serviceEntry: number;
  romSlot: number;
  romTable?: number;
}

export interface Ap6SidecarHarnessOptions {
  romPath?: string;
  romSlot: number;
  romBase?: number;
  ramFill?: number;
  cpuFactory?: CpuFactory;
  mos?: MosMock;
  romTable?: number;
  serviceEntry?: number;
  amalgam?: Omit<Ap6AmalgamModuleBinding, "romSlot">;
}

/** Shared Electron AP6 sidecar ROM harness (ROM Manager, Plus 1 Support). */
export abstract class Ap6SidecarHarness {
  readonly cpu: JsbeebCpu;
  readonly mos: MosMock;
  readonly romBase: number;
  readonly rom: Uint8Array;
  readonly serviceEntry: number;
  readonly romSlot: number;
  readonly romTable: number;

  protected readonly returnTrampoline = RETURN_TRAMPOLINE;
  private readonly amalgamMode: boolean;

  protected constructor(options: Ap6SidecarHarnessOptions) {
    this.romSlot = options.romSlot;
    this.romTable = options.romTable ?? ELECTRON_ROM_TABLE;
    this.amalgamMode = options.amalgam !== undefined;

    if (options.amalgam) {
      this.cpu = options.amalgam.cpu;
      this.mos = options.amalgam.mos;
      this.rom = options.amalgam.rom;
      this.romBase = options.amalgam.romBase;
      this.serviceEntry = options.amalgam.serviceEntry;
      this.cpu.writemem(this.returnTrampoline, 0xea);
      return;
    }

    if (!options.romPath) {
      throw new Error("Ap6SidecarHarness requires romPath or amalgam binding");
    }

    this.romBase = options.romBase ?? ROM_BASE;
    this.rom = loadRomImage(options.romPath);
    this.serviceEntry =
      options.serviceEntry ?? parseServiceEntry(this.rom, this.romBase);

    this.cpu = (options.cpuFactory ?? createJsbeebCpu)();
    this.mos = options.mos ?? new MosMock();
    this.resetMemory(options.ramFill ?? 0xea);
    this.mos.attach(this.cpu);
    this.cpu.writemem(this.returnTrampoline, 0xea);
  }

  /** Re-seed workspace in a shared amalgam (does not reload RAM/ROM). */
  prepareWorkspace(): void {
    this.seedWorkspace();
  }

  resetMemory(ramFill = 0xea): void {
    if (this.amalgamMode) {
      throw new Error("resetMemory() is not supported on amalgam module bindings");
    }
    fillMemory(this.cpu, ramFill);
    for (let i = 0; i < this.rom.length; i++) {
      this.cpu.writemem(this.romBase + i, this.rom[i]!);
    }
    this.cpu.writemem(this.returnTrampoline, 0xea);
    this.mos.reinstallStubs(this.cpu);
    this.mos.resetCaptures();
    this.seedWorkspace();
    this.cpu.halted = false;
  }

  setBreakType(value: 0 | 1 | 2): void {
    this.writeMemory(MOS_BREAK_TYPE, value);
  }

  setSessionLang(rom: number): void {
    const current = this.readMemory(ROM_MANAGER_L0D6D);
    this.writeMemory(ROM_MANAGER_L0D6D, (current & 0xf0) | (rom & 0x0f));
  }

  readMemory(address: number): number {
    return this.cpu.readmem(address & 0xffff);
  }

  writeMemory(address: number, value: number): void {
    this.cpu.writemem(address & 0xffff, value & 0xff);
  }

  registers() {
    return snapshotRegisters(this.cpu);
  }

  hasNvramLangRead(): boolean {
    return this.mos.getOsbyteCalls(161).some((call) => (call.x & 0xff) === 5);
  }

  protected invokeAtServiceEntry(
    serviceType: number,
    x: number,
    y: number,
  ): RunResult {
    const result = run6502(this.cpu, {
      pc: this.serviceEntry,
      a: serviceType & 0xff,
      x: x & 0xff,
      y: y & 0xff,
      returnAddress: this.returnTrampoline,
      flags: { i: true },
    });
    if (this.mos.unexpected.length > 0 && result.reason === "halted") {
      return {
        ...result,
        reason: "unexpected-mos",
        mosVector: this.mos.unexpected[this.mos.unexpected.length - 1],
      };
    }
    return result;
  }

  protected seedRomTable(): void {
    this.writeMemory(0xf4, this.romSlot);
    this.writeMemory(ROM_ENABLE_BASE + this.romSlot, 0x00);
    for (let slot = 0; slot < 16; slot++) {
      this.writeMemory(this.romTable + slot, 0x00);
    }
    this.writeMemory(ROM_MANAGER_L0D6D, 0x0c);
  }

  protected abstract seedWorkspace(): void;
}
