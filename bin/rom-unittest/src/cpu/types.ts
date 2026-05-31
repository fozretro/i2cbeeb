import type { MosVector } from "../bbc/mos.js";

/** Minimal surface of jsbeeb's 6502 used by the ROM test harness. */
export interface JsbeebCpu {
  a: number;
  x: number;
  y: number;
  s: number;
  pc: number;
  halted: boolean;
  p: {
    c: boolean;
    z: boolean;
    i: boolean;
    d: boolean;
    v: boolean;
    n: boolean;
    reset(): void;
    asByte(): number;
  };
  readmem(addr: number): number;
  writemem(addr: number, value: number): void;
  push(value: number): void;
  pull(): number;
  reset(hard?: boolean): void;
  execute(cycles: number): boolean;
  stop(): void;
  debugInstruction: {
    add(handler: (addr: number) => boolean): { remove(): void };
    clear(): void;
  };
}

export type CpuFactory = () => JsbeebCpu;

export interface RunResult {
  reason:
    | "return"
    | "brk"
    | "stop-address"
    | "max-cycles"
    | "max-instructions"
    | "unexpected-mos"
    | "halted";
  instructions: number;
  cycles: number;
  stopAddress?: number;
  mosVector?: MosVector;
}

export interface RunOptions {
  pc: number;
  a?: number;
  x?: number;
  y?: number;
  s?: number;
  flags?: Partial<{
    c: boolean;
    z: boolean;
    i: boolean;
    d: boolean;
    v: boolean;
    n: boolean;
  }>;
  /** Simulate JSR to `pc` by pushing this return address first. */
  returnAddress?: number;
  /** Stop when execution reaches this address (before the instruction runs). */
  stopAddress?: number;
  maxCycles?: number;
  maxInstructions?: number;
}

export interface CpuRegisters {
  a: number;
  x: number;
  y: number;
  s: number;
  pc: number;
  p: number;
}
