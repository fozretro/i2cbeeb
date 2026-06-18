import type { JsbeebCpu } from "../cpu/types.js";

/** Bus-layer hook addresses from BeebAsm labels (`i2cstart`, `i2caddr`, …). */
export interface I2cBusHookAddresses {
  /** START/STOP subroutines (peers of the byte-level routines below). */
  i2cstart: number;
  i2cstop: number;
  i2caddr: number;
  i2crxack: number;
  i2ctxack: number;
  i2crxbyte: number;
  i2ctxbyte: number;
  i2creset: number;
}

/**
 * Stateful mock for I2CBeeb bus subroutines (`i2caddr`, `i2crxack`, `i2ctxbyte`,
 * `i2crxbyte`, `i2ctxack`, `i2creset`). Macros (`i2cstart`, `i2cstop`, …) are
 * not patched — only the protocol entry points above.
 */
export class I2cBusMock {
  /** 7-bit device addresses that ACK address phases. */
  readonly respondingDevices = new Set<number>();

  /** Bytes captured by `i2ctxbyte`. */
  readonly txBytes: number[] = [];

  /** Bytes returned in order by `i2crxbyte`. */
  rxBytes: number[] = [];

  /** Addresses observed at each stubbed `i2caddr` entry (test diagnostics). */
  readonly addrLog: number[] = [];

  /** Number of stubbed `i2crxack` entries (test diagnostics). */
  rxAckCalls = 0;

  private lastAddress = 0;
  private hooks: Array<{ remove(): void }> = [];
  private patched: Array<{ address: number; opcode: number }> = [];

  reset(): void {
    this.respondingDevices.clear();
    this.txBytes.length = 0;
    this.rxBytes = [];
    this.addrLog.length = 0;
    this.rxAckCalls = 0;
    this.lastAddress = 0;
  }

  addDevice(address: number): void {
    this.respondingDevices.add(address & 0x7f);
  }

  setRxBytes(...bytes: number[]): void {
    this.rxBytes = bytes.map((b) => b & 0xff);
  }

  install(cpu: JsbeebCpu, hooks: I2cBusHookAddresses): void {
    this.detach(cpu);
    this.patch(cpu, hooks.i2caddr, () => {
      this.lastAddress = cpu.a & 0x7f;
      this.addrLog.push(this.lastAddress);
    });
    this.patch(cpu, hooks.i2crxack, () => {
      this.rxAckCalls++;
      const ack = this.respondingDevices.has(this.lastAddress);
      cpu.p.c = !ack;
    });
    this.patch(cpu, hooks.i2ctxbyte, () => {
      this.txBytes.push(cpu.a & 0xff);
    });
    this.patch(cpu, hooks.i2crxbyte, () => {
      cpu.a = this.rxBytes.shift() ?? 0;
    });
    this.patch(cpu, hooks.i2ctxack, () => {});
    this.patch(cpu, hooks.i2creset, () => {});
    // START/STOP subroutines: bypass the inline VIA bit-bang (and the BBC
    // clock-stretch busy-wait that cannot complete headless).
    this.patch(cpu, hooks.i2cstart, () => {});
    this.patch(cpu, hooks.i2cstop, () => {});
  }

  detach(cpu?: JsbeebCpu): void {
    for (const hook of this.hooks) {
      hook.remove();
    }
    this.hooks = [];
    if (cpu) {
      for (const { address, opcode } of this.patched) {
        cpu.writemem(address, opcode);
      }
    }
    this.patched = [];
  }

  private patch(cpu: JsbeebCpu, address: number, onEntry: () => void): void {
    const opcode = cpu.readmem(address);
    cpu.writemem(address, 0x60);
    this.patched.push({ address, opcode });
    this.hooks.push(
      cpu.debugInstruction.add((addr) => {
        if (addr !== address) {
          return false;
        }
        onEntry();
        return false;
      }),
    );
  }
}
