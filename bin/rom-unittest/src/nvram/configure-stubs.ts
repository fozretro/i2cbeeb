import type { JsbeebCpu } from "../cpu/types.js";

/** Stub `CON_ReadKeySwitches`: A=&08 so SET_Reset keeps NOBOOT (bit 3 = no boot on Master dips). */
export class ReadKeySwitchesStub {
  private hook: { remove(): void } | null = null;
  private address: number | null = null;
  private opcode: number | null = null;

  install(cpu: JsbeebCpu, entry: number): void {
    this.detach(cpu);
    this.address = entry;
    this.opcode = cpu.readmem(entry);
    cpu.writemem(entry, 0x60);
    this.hook = cpu.debugInstruction.add((addr) => {
      if (addr !== entry) return false;
      cpu.a = 0x08;
      return false;
    });
  }

  detach(cpu?: JsbeebCpu): void {
    this.hook?.remove();
    this.hook = null;
    if (cpu && this.address !== null && this.opcode !== null) {
      cpu.writemem(this.address, this.opcode);
    }
    this.address = null;
    this.opcode = null;
  }
}
