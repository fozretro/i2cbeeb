import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { JsbeebCpu } from "@i2cbeeb-unittest/cpu/types.js";
import { ROM_BASE } from "@i2cbeeb-unittest/bbc/mos.js";
import {
  loadBeebAsmLabels,
  symbolAddress,
} from "@i2cbeeb-unittest/beebasm/labels.js";
import type { I2cBusHookAddresses } from "@i2cbeeb-unittest/i2c/bus-mock.js";
import {
  createJsbeebCpu,
  fillMemory,
  run6502,
} from "@i2cbeeb-unittest/cpu/jsbeeb-cpu.js";
import type { RunResult } from "@i2cbeeb-unittest/cpu/types.js";
import { I2cBusMock } from "@i2cbeeb-unittest/i2c/bus-mock.js";
import { MosMock } from "@i2cbeeb-unittest/mos/mos-mock.js";
import { writeCommandLine } from "@i2cbeeb-unittest/harness/rom-test-harness.js";
import { installAp6Mock } from "./ap6-mock.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(testsDir, "../out");

const RETURN_TRAMPOLINE = 0x0200;
const COMMAND_LINE = 0x0900;

export interface I2CTestHarnessOptions {
  romPath?: string;
  execPath?: string;
  labelsPath: string;
  romBase?: number;
}

/** Minimal harness for src.i2ctest ROM (*I2CTEST) and EXEC (*RUN I2CT) builds. */
export class I2CTestHarness {
  readonly cpu: JsbeebCpu;
  readonly mos: MosMock;
  readonly romBase: number;
  readonly rom?: Uint8Array;
  readonly exec?: Uint8Array;
  readonly serviceEntry: number;
  /** BeebAsm SAVE load address (exec_start). */
  readonly execLoad: number;
  /** BeebAsm SAVE run address (runtests). */
  readonly execRun: number;
  readonly busMock = new I2cBusMock();

  private readonly labelsPath: string;
  private ap6Mock?: ReturnType<typeof installAp6Mock>;

  constructor(options: I2CTestHarnessOptions) {
    this.labelsPath = options.labelsPath;
    this.romBase = options.romBase ?? ROM_BASE;
    const symbols = loadBeebAsmLabels(options.labelsPath);
    this.serviceEntry = symbolAddress(symbols, "service") ?? 0;
    this.execLoad = symbolAddress(symbols, "start") ?? 0;
    this.execRun = symbolAddress(symbols, "runtests") ?? 0;

    if (options.romPath) {
      this.rom = loadBinary(options.romPath);
      if (this.serviceEntry === 0) {
        throw new Error("ROM harness requires service symbol in labels");
      }
    }
    if (options.execPath) {
      this.exec = loadBinary(options.execPath);
      if (this.execLoad === 0) {
        throw new Error("EXEC harness requires start symbol in labels");
      }
      if (this.execRun === 0) {
        throw new Error("EXEC harness requires runtests symbol in labels");
      }
    }

    this.cpu = createJsbeebCpu();
    this.mos = new MosMock();
    this.reset();
  }

  reset(): void {
    fillMemory(this.cpu, 0xea);
    if (this.rom) {
      for (let i = 0; i < this.rom.length; i++) {
        this.cpu.writemem(this.romBase + i, this.rom[i]!);
      }
    }
    if (this.exec) {
      for (let i = 0; i < this.exec.length; i++) {
        this.cpu.writemem(this.execLoad + i, this.exec[i]!);
      }
    }
    this.cpu.writemem(RETURN_TRAMPOLINE, 0xea);
    this.mos.attach(this.cpu);
    this.mos.resetCaptures();
    this.installMocks();
  }

  installMocks(devices: number[] = [0x50]): void {
    this.ap6Mock?.remove();
    this.ap6Mock = installAp6Mock(this.cpu);
    this.busMock.reset();
    this.busMock.enableNvram(0x50);
    for (const device of devices) {
      this.busMock.addDevice(device);
    }
    const symbols = loadBeebAsmLabels(this.labelsPath);
    this.busMock.install(this.cpu, i2ctestBusHookAddresses(symbols));
  }

  invokeI2CTest(): RunResult {
    const commandText = "I2CTEST\r";
    writeCommandLine(this.cpu, COMMAND_LINE, commandText);
    this.cpu.writemem(0xf2, COMMAND_LINE & 0xff);
    this.cpu.writemem(0xf3, (COMMAND_LINE >> 8) & 0xff);
    return run6502(this.cpu, {
      pc: this.serviceEntry,
      a: 4,
      x: 0,
      y: 0,
      returnAddress: RETURN_TRAMPOLINE,
      stopAddress: RETURN_TRAMPOLINE,
    });
  }

  runExec(): RunResult {
    return run6502(this.cpu, {
      pc: this.execRun,
      returnAddress: RETURN_TRAMPOLINE,
      stopAddress: RETURN_TRAMPOLINE,
    });
  }

  outputText(): string {
    return this.mos.getOutputText();
  }

  /** Null if every &FCD6 write had D0/D4 safe; otherwise the first violation message. */
  ap6SafeBitViolation(): string | null {
    return this.ap6Mock?.safeBitViolation() ?? null;
  }
}

function loadBinary(path: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(path)));
}

/** Bus hook addresses for tests 01-10 (byte routines used by 09-10). */
function i2ctestBusHookAddresses(symbols: ReturnType<typeof loadBeebAsmLabels>): I2cBusHookAddresses {
  const req = (name: string): number => {
    const address = symbolAddress(symbols, name);
    if (address === null) {
      throw new Error(`BeebAsm labels file has no symbol ${name}`);
    }
    return address;
  };

  return {
    i2cstart: req("i2cstart"),
    i2cstop: req("i2cstop"),
    i2caddr: req("i2caddr"),
    i2crxack: req("i2crxack"),
    i2ctxack: req("i2ctxack"),
    i2crxbyte: req("i2crxbyte"),
    i2ctxbyte: req("i2ctxbyte"),
    i2creset: 0,
  };
}

export const defaultRomHarness = (): I2CTestHarness =>
  new I2CTestHarness({
    romPath: resolve(outDir, "rom/I2CTROM"),
    labelsPath: resolve(outDir, "i2ctest-rom.labels"),
  });

export const defaultExecHarness = (): I2CTestHarness =>
  new I2CTestHarness({
    execPath: resolve(outDir, "exec/I2CT"),
    labelsPath: resolve(outDir, "i2ctest-exec.labels"),
  });
