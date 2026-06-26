import type { JsbeebCpu } from "@i2cbeeb-unittest/cpu/types.js";

/** AP6 control register (Electron Plus 1 I²C header). */
export const AP6_REG = 0xfcd6;

/** D0 (IC1 A14) and D4 (write inhibit) must be high on every write (see AP6_SAFE in i2ctest.asm). */
export const AP6_SAFE_MASK = 0x11;

export interface Ap6MockHandle {
  remove(): void;
  /** First &FCD6 write that cleared a required safe bit, or null if all writes were safe. */
  safeBitViolation(): string | null;
  resetViolations(): void;
}

/**
 * Open-drain simulation: reads from &FCD6 return the last written latch so
 * bit-bang tests 01–07 can observe SDA state without real hardware.
 */
export function installAp6Mock(cpu: JsbeebCpu): Ap6MockHandle {
  const readmem = cpu.readmem.bind(cpu);
  const writemem = cpu.writemem.bind(cpu);
  let latch = 0;
  let violation: string | null = null;

  const noteViolation = (address: number, value: number): void => {
    if (violation !== null) {
      return;
    }
    if ((value & AP6_SAFE_MASK) === AP6_SAFE_MASK) {
      return;
    }
    violation =
      `unsafe &FCD6 write at &${address.toString(16)}: ` +
      `&${(value & 0xff).toString(16).padStart(2, "0")} ` +
      `(need D0 and D4 set, mask &${AP6_SAFE_MASK.toString(16)})`;
  };

  cpu.readmem = (address: number): number => {
    if ((address & 0xffff) === AP6_REG) {
      return latch & 0xff;
    }
    return readmem(address);
  };

  cpu.writemem = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (addr === AP6_REG) {
      const byte = value & 0xff;
      noteViolation(addr, byte);
      latch = byte;
    }
    writemem(addr, value & 0xff);
  };

  return {
    remove(): void {
      cpu.readmem = readmem;
      cpu.writemem = writemem;
    },
    safeBitViolation(): string | null {
      return violation;
    },
    resetViolations(): void {
      violation = null;
    },
  };
}
