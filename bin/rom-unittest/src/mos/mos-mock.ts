import { MOS, MOS_CONFIGURE, type MosVector } from "../bbc/mos.js";
import type { JsbeebCpu } from "../cpu/types.js";
import { gsinit, gsread } from "./gs-init-read.js";

export interface MosByteCall {
  vector: MosVector;
  a: number;
  x: number;
  y: number;
}

export interface MosWordCall {
  vector: typeof MOS.OSWORD;
  a: number;
  x: number;
  y: number;
  block: Uint8Array;
}

export type OsbyteHandler = (call: MosByteCall) => { a?: number; x?: number; y?: number; carry?: boolean };
export type OswordHandler = (call: MosWordCall) => { a?: number; x?: number; y?: number; block?: Uint8Array };
export type OswrchHandler = (char: number) => void;
export type OscliHandler = (call: MosByteCall) => void;

export interface MosMockOptions {
  /** Fail the run when a MOS vector without a handler is invoked. Default true. */
  failOnUnexpected?: boolean;
}

const MOS_VECTORS: MosVector[] = Object.values(MOS);
const PATCH_VECTORS: number[] = [...MOS_VECTORS, ...Object.values(MOS_CONFIGURE)];

/**
 * Intercepts MOS API calls via jsbeeb's debugInstruction hook.
 * Each vector is patched with RTS ($60); the hook runs before RTS executes.
 */
export class MosMock {
  readonly oswrch: number[] = [];
  readonly oscli: string[] = [];
  readonly unexpected: MosVector[] = [];
  readonly osbyteLog: MosByteCall[] = [];

  private readonly osbyteHandlers = new Map<number, OsbyteHandler>();
  private osbyteDefault?: OsbyteHandler;
  private readonly oswordHandlers = new Map<number, OswordHandler>();
  private oswordDefault?: OswordHandler;
  private oswrchHandler: OswrchHandler;
  private oscliHandler?: OscliHandler;
  private readonly failOnUnexpected: boolean;
  private hook: { remove(): void } | null = null;
  private cpu: JsbeebCpu | null = null;

  constructor(options: MosMockOptions = {}) {
    this.failOnUnexpected = options.failOnUnexpected ?? true;
    this.oswrchHandler = (char) => {
      this.oswrch.push(char & 0xff);
    };
  }

  onOswrch(handler: OswrchHandler): this {
    this.oswrchHandler = handler;
    return this;
  }

  onOscli(handler: OscliHandler): this {
    this.oscliHandler = handler;
    return this;
  }

  stubOsbyte(code: number, handler: OsbyteHandler): this {
    this.osbyteHandlers.set(code & 0xff, handler);
    return this;
  }

  stubOsbyteDefault(handler: OsbyteHandler): this {
    this.osbyteDefault = handler;
    return this;
  }

  stubOsword(code: number, handler: OswordHandler): this {
    this.oswordHandlers.set(code & 0xff, handler);
    return this;
  }

  stubOswordDefault(handler: OswordHandler): this {
    this.oswordDefault = handler;
    return this;
  }

  attach(cpu: JsbeebCpu): void {
    this.detach();
    this.cpu = cpu;
    for (const vector of PATCH_VECTORS) {
      cpu.writemem(vector, 0x60);
    }
    this.hook = cpu.debugInstruction.add((addr) => this.dispatch(addr));
  }

  /** Re-apply RTS stubs after RAM is cleared. */
  reinstallStubs(cpu: JsbeebCpu): void {
    for (const vector of PATCH_VECTORS) {
      cpu.writemem(vector, 0x60);
    }
  }

  detach(): void {
    this.hook?.remove();
    this.hook = null;
    this.cpu = null;
  }

  resetCaptures(): void {
    this.oswrch.length = 0;
    this.oscli.length = 0;
    this.unexpected.length = 0;
    this.osbyteLog.length = 0;
  }

  getOsbyteCalls(code?: number): readonly MosByteCall[] {
    if (code === undefined) {
      return this.osbyteLog;
    }
    return this.osbyteLog.filter((call) => call.a === (code & 0xff));
  }

  getOutputText(): string {
    return this.oswrch.map((c) => String.fromCharCode(c)).join("");
  }

  private dispatch(addr: number): boolean {
    const cpu = this.cpu;
    if (!cpu) return false;

    switch (addr) {
      case MOS.OSWRCH:
      case MOS.OSASCI:
        this.oswrchHandler(cpu.a & 0xff);
        return false;
      case MOS.OSNEWL:
        this.oswrchHandler(0x0d);
        this.oswrchHandler(0x0a);
        return false;
      case MOS.OSBYTE:
        return this.handleOsbyte(cpu);
      case MOS.OSWORD:
        return this.handleOsword(cpu);
      case MOS.OSCLI:
        return this.handleOscli(cpu);
      case MOS.OSRDCH:
        return this.handleUnexpected(cpu, MOS.OSRDCH);
    }

    if (addr === MOS_CONFIGURE.GSINIT) {
      gsinit(cpu);
      return false;
    }
    if (addr === MOS_CONFIGURE.GSREAD) {
      gsread(cpu);
      return false;
    }

    return false;
  }

  private handleOsbyte(cpu: JsbeebCpu): boolean {
    const call: MosByteCall = {
      vector: MOS.OSBYTE,
      a: cpu.a & 0xff,
      x: cpu.x & 0xff,
      y: cpu.y & 0xff,
    };
    this.osbyteLog.push({ ...call });
    const handler = this.osbyteHandlers.get(call.a) ?? this.osbyteDefault;
    if (!handler) {
      return this.handleUnexpected(cpu, MOS.OSBYTE);
    }
    const result = handler(call);
    if (result.a !== undefined) cpu.a = result.a & 0xff;
    if (result.x !== undefined) cpu.x = result.x & 0xff;
    if (result.y !== undefined) cpu.y = result.y & 0xff;
    if (result.carry !== undefined) cpu.p.c = result.carry;
    return false;
  }

  private handleOsword(cpu: JsbeebCpu): boolean {
    const blockPtr = (cpu.x & 0xff) | ((cpu.y & 0xff) << 8);
    const block = this.readBlock(cpu, blockPtr, 256);
    const call: MosWordCall = {
      vector: MOS.OSWORD,
      a: cpu.a & 0xff,
      x: cpu.x & 0xff,
      y: cpu.y & 0xff,
      block,
    };
    const handler = this.oswordHandlers.get(call.a) ?? this.oswordDefault;
    if (!handler) {
      return this.handleUnexpected(cpu, MOS.OSWORD);
    }
    const result = handler(call);
    if (result.a !== undefined) cpu.a = result.a & 0xff;
    if (result.x !== undefined) cpu.x = result.x & 0xff;
    if (result.y !== undefined) cpu.y = result.y & 0xff;
    if (result.block) {
      this.writeBlock(cpu, blockPtr, result.block);
    }
    return false;
  }

  private handleOscli(cpu: JsbeebCpu): boolean {
    const call: MosByteCall = {
      vector: MOS.OSCLI,
      a: cpu.a & 0xff,
      x: cpu.x & 0xff,
      y: cpu.y & 0xff,
    };
    if (this.oscliHandler) {
      this.oscliHandler(call);
    } else if (this.failOnUnexpected) {
      return this.handleUnexpected(cpu, MOS.OSCLI);
    }
    this.oscli.push(`A=${call.a} X=${call.x} Y=${call.y}`);
    return false;
  }

  private handleUnexpected(cpu: JsbeebCpu, vector: MosVector): boolean {
    this.unexpected.push(vector);
    if (this.failOnUnexpected) {
      cpu.stop();
      return true;
    }
    return false;
  }

  private readBlock(cpu: JsbeebCpu, ptr: number, length: number): Uint8Array {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = cpu.readmem((ptr + i) & 0xffff);
    }
    return out;
  }

  private writeBlock(cpu: JsbeebCpu, ptr: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      cpu.writemem((ptr + i) & 0xffff, data[i]!);
    }
  }
}

export function isMosVector(address: number): address is MosVector {
  return MOS_VECTORS.includes(address as MosVector);
}
