declare module "jsbeeb/fake6502.js" {
  export interface JsbeebFlags {
    c: boolean;
    z: boolean;
    i: boolean;
    d: boolean;
    v: boolean;
    n: boolean;
    reset(): void;
    asByte(): number;
  }

  export interface JsbeebCpuInstance {
    a: number;
    x: number;
    y: number;
    s: number;
    pc: number;
    halted: boolean;
    p: JsbeebFlags;
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

  export function fake6502(model?: unknown, opts?: unknown): JsbeebCpuInstance;
  export function fake65C12(): JsbeebCpuInstance;
}
