import { ZP } from "../bbc/mos.js";
import {
  Ap6SidecarHarness,
  MOS_BREAK_TYPE,
  ROM_MANAGER_L0D6D,
  type Ap6AmalgamModuleBinding,
  type Ap6SidecarHarnessOptions,
} from "./ap6-sidecar-harness.js";

export { MOS_BREAK_TYPE, ROM_MANAGER_L0D6D };

/** MOS language ROM type byte (language bit set). */
export const MOS_LANG_ROM_TYPE = 0xc0;

export type Plus1SupportHarnessOptions = Omit<Ap6SidecarHarnessOptions, "romSlot"> & {
  romSlot?: number;
  romPath?: string;
};

export class Plus1SupportTestHarness extends Ap6SidecarHarness {
  constructor(options: Plus1SupportHarnessOptions) {
    super({ ...options, romSlot: options.romSlot ?? 8 });
  }

  static forAmalgamModule(binding: Ap6AmalgamModuleBinding): Plus1SupportTestHarness {
    return new Plus1SupportTestHarness({ amalgam: binding, romSlot: binding.romSlot });
  }

  setLanguageRom(slot: number, type = MOS_LANG_ROM_TYPE): void {
    this.writeMemory(this.romTable + slot, type);
  }

  invokeRestoreRomTableLang() {
    this.writeMemory(ZP.OSW_A, 0xa3);
    this.writeMemory(ZP.OSW_X, 0x80);
    this.writeMemory(ZP.OSW_Y, 0x04);
    return this.invokeAtServiceEntry(7, this.romSlot, 0);
  }

  getSelectedLangRom(): number {
    return this.readMemory(ZP.OSW_X) & 0x0f;
  }

  protected override seedWorkspace(): void {
    this.seedRomTable();
    this.writeMemory(0x0d68, 0x00);
    this.setBreakType(0);
  }
}
