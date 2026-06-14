import { fake6502 } from "jsbeeb/fake6502.js";
import type { CpuFactory, JsbeebCpu, RunOptions, RunResult } from "./types.js";

/** Create a jsbeeb TEST-model 6502 with a flat 64 KiB RAM map (no BBC hardware). */
export function createJsbeebCpu(): JsbeebCpu {
  const cpu = fake6502() as JsbeebCpu;
  cpu.reset(true);
  return cpu;
}

export const defaultCpuFactory: CpuFactory = createJsbeebCpu;

export function pushReturnAddress(cpu: JsbeebCpu, address: number): void {
  // jsbeeb's RTS increments the stacked address (matches hardware JSR/RTS semantics).
  const stacked = (address - 1) & 0xffff;
  cpu.push((stacked >> 8) & 0xff);
  cpu.push(stacked & 0xff);
}

export function readFlags(cpu: JsbeebCpu): number {
  return cpu.p.asByte();
}

export function writeFlags(
  cpu: JsbeebCpu,
  flags: Partial<{ c: boolean; z: boolean; i: boolean; d: boolean; v: boolean; n: boolean }>,
): void {
  if (flags.c !== undefined) cpu.p.c = flags.c;
  if (flags.z !== undefined) cpu.p.z = flags.z;
  if (flags.i !== undefined) cpu.p.i = flags.i;
  if (flags.d !== undefined) cpu.p.d = flags.d;
  if (flags.v !== undefined) cpu.p.v = flags.v;
  if (flags.n !== undefined) cpu.p.n = flags.n;
}

export function snapshotRegisters(cpu: JsbeebCpu) {
  return {
    a: cpu.a & 0xff,
    x: cpu.x & 0xff,
    y: cpu.y & 0xff,
    s: cpu.s & 0xff,
    pc: cpu.pc & 0xffff,
    p: readFlags(cpu),
  };
}

export function fillMemory(cpu: JsbeebCpu, value: number, start = 0, end = 0xffff): void {
  for (let addr = start; addr <= end; addr++) {
    cpu.writemem(addr, value);
  }
}

/** Run the 6502 core until return, limit, or external stop (via `cpu.stop()`). */
export function run6502(cpu: JsbeebCpu, options: RunOptions): RunResult {
  cpu.halted = false;
  cpu.p.reset();
  writeFlags(cpu, { i: true, ...options.flags });

  cpu.a = options.a ?? 0;
  cpu.x = options.x ?? 0;
  cpu.y = options.y ?? 0;
  cpu.s = options.s ?? 0xfd;

  if (options.returnAddress !== undefined) {
    pushReturnAddress(cpu, options.returnAddress);
  }

  cpu.pc = options.pc & 0xffff;

  const maxCycles = options.maxCycles ?? 5_000_000;
  const maxInstructions = options.maxInstructions ?? 2_000_000;
  const stopAddress = options.stopAddress ?? options.returnAddress;

  let instructions = 0;
  let cycles = 0;
  let reason: RunResult["reason"] = "halted";
  // jsbeeb's executeInternal() skips the debugInstruction hook on the FIRST
  // instruction of every execute() call (see `!first` in 6502.js). The MOS mock
  // captures OSWRCH/OSBYTE/etc via that hook, so any chunk boundary that lands on
  // a $FFxx MOS-vector RTS stub silently drops the interception (e.g. a lost
  // character in *STATUS output). Run the whole budget in one execute() call so
  // only the harmless entry instruction is ever skipped.
  const chunk = maxCycles;

  const stepHook = cpu.debugInstruction.add((addr) => {
    instructions++;
    if (stopAddress !== undefined && addr === stopAddress) {
      reason = addr === options.returnAddress ? "return" : "stop-address";
      cpu.stop();
      return true;
    }
    return false;
  });

  try {
    while (!cpu.halted && instructions < maxInstructions && cycles < maxCycles) {
      if (!cpu.execute(chunk)) {
        break;
      }
      cycles += chunk;
    }
    if (instructions >= maxInstructions && reason === "halted") reason = "max-instructions";
    if (cycles >= maxCycles && reason === "halted") reason = "max-cycles";
  } finally {
    stepHook.remove();
  }

  return {
    reason,
    instructions,
    cycles,
    stopAddress,
  };
}
