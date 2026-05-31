import type { JsbeebCpu } from "../cpu/types.js";
import {
  createDefaultNvramImage,
  createBlankNvramImage,
  mergeNvramImage,
  type NvramImage,
  type PartialNvramImage,
} from "./defaults.js";

/** RAM workspace addresses invoked by configure startup (Electron helpers). */
const CONFIGURE_WORKSPACE_RTS = [0xc300] as const;

export function installConfigureWorkspaceStubs(cpu: JsbeebCpu): void {
  for (const address of CONFIGURE_WORKSPACE_RTS) {
    cpu.writemem(address, 0x60);
  }
}

/**
 * In-memory NVRAM mock: stubs `FRAM_readByte` / `FRAM_writeByte` so configure
 * startup does not hit the real I2C path.
 */
export class NvramMock {
  image: NvramImage;

  private readHook: { remove(): void } | null = null;
  private writeHook: { remove(): void } | null = null;
  private readAddress: number | null = null;
  private writeAddress: number | null = null;
  private readOpcode: number | null = null;
  private writeOpcode: number | null = null;

  constructor(initial?: PartialNvramImage) {
    this.image = mergeNvramImage(initial);
  }

  reset(initial?: PartialNvramImage): void {
    this.image = mergeNvramImage(initial);
  }

  /** Replace the image, optionally merging overrides onto a supplied base. */
  loadImage(base: NvramImage, overrides?: PartialNvramImage): void {
    this.image = mergeNvramImage(overrides, base);
  }

  setBytes(overrides: PartialNvramImage): void {
    this.image = mergeNvramImage(overrides, this.image);
  }

  install(cpu: JsbeebCpu, readEntry: number, writeEntry: number): void {
    this.detach(cpu);
    this.installRead(cpu, readEntry);
    this.installWrite(cpu, writeEntry);
  }

  detach(cpu?: JsbeebCpu): void {
    this.readHook?.remove();
    this.readHook = null;
    this.writeHook?.remove();
    this.writeHook = null;
    if (cpu) {
      if (this.readAddress !== null && this.readOpcode !== null) {
        cpu.writemem(this.readAddress, this.readOpcode);
      }
      if (this.writeAddress !== null && this.writeOpcode !== null) {
        cpu.writemem(this.writeAddress, this.writeOpcode);
      }
    }
    this.readAddress = null;
    this.writeAddress = null;
    this.readOpcode = null;
    this.writeOpcode = null;
  }

  private installRead(cpu: JsbeebCpu, address: number): void {
    this.readAddress = address;
    this.readOpcode = cpu.readmem(address);
    cpu.writemem(address, 0x60);
    this.readHook = cpu.debugInstruction.add((addr) => {
      if (addr !== address) return false;
      cpu.y = this.image[cpu.x & 0xff]!;
      return false;
    });
  }

  private installWrite(cpu: JsbeebCpu, address: number): void {
    this.writeAddress = address;
    this.writeOpcode = cpu.readmem(address);
    cpu.writemem(address, 0x60);
    this.writeHook = cpu.debugInstruction.add((addr) => {
      if (addr !== address) return false;
      this.image[cpu.x & 0xff] = cpu.y & 0xff;
      return false;
    });
  }
}

export { createDefaultNvramImage, createBlankNvramImage, mergeNvramImage, type NvramImage, type PartialNvramImage };
