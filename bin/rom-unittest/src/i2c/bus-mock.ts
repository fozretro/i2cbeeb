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
  private nvramDevice: number | null = null;
  private nvramMem = new Map<number, number>();
  private nvramReg = 0;
  private expectRegByte = false;
  private expectReadByte = false;
  private hooks: Array<{ remove(): void }> = [];
  private patched: Array<{ address: number; opcode: number }> = [];

  reset(): void {
    this.respondingDevices.clear();
    this.txBytes.length = 0;
    this.rxBytes = [];
    this.addrLog.length = 0;
    this.rxAckCalls = 0;
    this.lastAddress = 0;
    this.nvramMem.clear();
    this.nvramReg = 0;
    this.expectRegByte = false;
    this.expectReadByte = false;
  }

  /** PCF8583-style register file: first tx byte selects reg, second stores data. */
  enableNvram(device: number): void {
    this.nvramDevice = device & 0x7f;
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
      if (this.nvramDevice === this.lastAddress) {
        if (cpu.p.c) {
          this.expectReadByte = true;
          this.expectRegByte = false;
        } else {
          this.expectRegByte = true;
          this.expectReadByte = false;
        }
      }
    });
    this.patch(cpu, hooks.i2crxack, () => {
      this.rxAckCalls++;
      const ack = this.respondingDevices.has(this.lastAddress);
      cpu.p.c = !ack;
    });
    this.patch(cpu, hooks.i2ctxbyte, () => {
      const byte = cpu.a & 0xff;
      this.txBytes.push(byte);
      if (this.nvramDevice === this.lastAddress) {
        if (this.expectRegByte) {
          this.nvramReg = byte;
          this.expectRegByte = false;
        } else {
          this.nvramMem.set(this.nvramReg, byte);
        }
      }
    });
    this.patch(cpu, hooks.i2crxbyte, () => {
      if (this.nvramDevice === this.lastAddress && this.expectReadByte) {
        cpu.a = this.nvramMem.get(this.nvramReg) ?? 0;
        this.expectReadByte = false;
        return;
      }
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
    if (address === 0) {
      return;
    }
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
