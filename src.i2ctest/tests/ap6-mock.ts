import type { JsbeebCpu } from "@i2cbeeb-unittest/cpu/types.js";

/** AP6 control register (Electron Plus 1 I²C header). */
export const AP6_REG = 0xfcd6;

/** Shadow of last value written to {@link AP6_REG} (`ap6regc` in i2ctest.asm). */
export const AP6_SHADOW = 0x70;

/**
 * Open-drain simulation: reads from &FCD6 return the shadow at &70 so
 * bit-bang tests 01–07 can observe SDA/SCL state without real hardware.
 */
export function installAp6Mock(cpu: JsbeebCpu): { remove(): void } {
  const readmem = cpu.readmem.bind(cpu);
  const writemem = cpu.writemem.bind(cpu);

  cpu.readmem = (address: number): number => {
    if ((address & 0xffff) === AP6_REG) {
      return readmem(AP6_SHADOW) & 0xff;
    }
    return readmem(address);
  };

  cpu.writemem = (address: number, value: number): void => {
    const addr = address & 0xffff;
    if (addr === AP6_REG) {
      writemem(AP6_SHADOW, value & 0xff);
    }
    writemem(addr, value & 0xff);
  };

  return {
    remove(): void {
      cpu.readmem = readmem;
      cpu.writemem = writemem;
    },
  };
}
