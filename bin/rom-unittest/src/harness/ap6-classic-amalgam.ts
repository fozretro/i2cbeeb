import { configureHookAddresses, loadBeebAsmLabels } from "../beebasm/labels.js";
import { ROM_BASE } from "../bbc/mos.js";
import { createJsbeebCpu, fillMemory } from "../cpu/jsbeeb-cpu.js";
import type { JsbeebCpu } from "../cpu/types.js";
import { createDefaultConfigureNvramImage } from "../nvram/configure-defaults.js";
import { ReadKeySwitchesStub } from "../nvram/configure-stubs.js";
import { NvramMock, installConfigureWorkspaceStubs } from "../nvram/nvram-mock.js";
import type { PartialNvramImage } from "../nvram/defaults.js";
import { MosMock } from "../mos/mos-mock.js";
import { RETURN_TRAMPOLINE, MOS_MACHINE_TYPE } from "./ap6-sidecar-harness.js";
import {
  createDefaultClassicServ7Store,
  installClassicServ7OsbyteStubs,
  installDelegatingClassicServ7Osbyte,
  type ClassicServ7Store,
} from "./classic-serv7-osbyte.js";
import { installNvramServ7OsbyteStubs } from "./nvram-serv7-osbyte.js";
import { Plus1SupportTestHarness } from "./plus1-support-harness.js";
import { RomManagerTestHarness } from "./rom-manager-harness.js";
import { loadRomImage, parseServiceEntry } from "./rom-test-harness.js";

/** Sideways slot where the classic AP6 amalgam is paged in during tests. */
export const AP6_CLASSIC_COMPOSITE_ROM_SLOT = 12;

export interface Ap6ClassicAmalgamOptions {
  romPath: string;
  romSlot?: number;
  /** ap6 amalgam: relocated I²C labels for FRAM hooks + PCF8583-backed Serv7 OSBYTE. */
  labelsPath?: string;
}

/**
 * Shared CPU/RAM for SMJoin amalgam ROM tests (`ap6.rom`, `ap6-classic.rom`, …).
 * Service calls use the composite `$8003` entry; SMJoin internal chaining dispatches
 * to Plus 1, ROM Manager, I²C slice, etc. — no separate service-4 entry per module.
 */
export class Ap6ClassicAmalgamSession {
  readonly cpu: JsbeebCpu;
  readonly mos: MosMock;
  readonly rom: Uint8Array;
  readonly romBase = ROM_BASE;
  readonly serviceEntry: number;
  readonly romSlot: number;
  readonly serv7Store: ClassicServ7Store;
  readonly romManager: RomManagerTestHarness;
  readonly plus1: Plus1SupportTestHarness;

  private readonly nvramMock = new NvramMock();
  private readonly readKeySwitchesStub = new ReadKeySwitchesStub();
  private readonly configureEnabled: boolean;
  private readonly framReadEntry: number | null;
  private readonly framWriteEntry: number | null;
  private readonly readKeySwitchesEntry: number | null;

  constructor(options: Ap6ClassicAmalgamOptions) {
    this.romSlot = options.romSlot ?? AP6_CLASSIC_COMPOSITE_ROM_SLOT;
    this.rom = loadRomImage(options.romPath);
    this.serviceEntry = parseServiceEntry(this.rom, this.romBase);
    this.cpu = createJsbeebCpu();
    this.mos = new MosMock();
    this.serv7Store = createDefaultClassicServ7Store();

    if (options.labelsPath) {
      const hooks = configureHookAddresses(loadBeebAsmLabels(options.labelsPath));
      this.framReadEntry = hooks.framReadByte;
      this.framWriteEntry = hooks.framWriteByte;
      this.readKeySwitchesEntry = hooks.readKeySwitches;
      this.configureEnabled =
        this.framReadEntry !== null && this.framWriteEntry !== null;
    } else {
      this.framReadEntry = null;
      this.framWriteEntry = null;
      this.readKeySwitchesEntry = null;
      this.configureEnabled = false;
    }

    this.loadRomImageIntoCpu();
    this.mos.attach(this.cpu);
    this.installServ7Stubs();

    const binding = {
      cpu: this.cpu,
      mos: this.mos,
      rom: this.rom,
      romBase: this.romBase,
      serviceEntry: this.serviceEntry,
      romSlot: this.romSlot,
    };

    this.romManager = RomManagerTestHarness.forAmalgamModule(binding);
    this.plus1 = Plus1SupportTestHarness.forAmalgamModule(binding);
  }

  /**
   * Opt-in: route OSBYTE 161/162 through ROM Manager's REAL 6502 Serv7 (via a
   * nested service-7 dispatch) instead of the JS stub. Call after {@link reset}.
   * Only valid for the classic (no-I²C) amalgam, where ROM Manager's Serv7 is the
   * NVRAM provider; throws otherwise.
   */
  delegateNvramToRealServ7(): void {
    if (this.configureEnabled) {
      throw new Error(
        "delegateNvramToRealServ7() is only for the classic (no-I²C) amalgam; " +
          "the I²C build answers OSBYTE 161/162 from the PCF8583 slice, not Serv7",
      );
    }
    installDelegatingClassicServ7Osbyte(this.mos, {
      cpu: this.cpu,
      serviceEntry: this.serviceEntry,
      romSlot: this.romSlot,
    });
  }

  /** PCF8583 image when {@link Ap6ClassicAmalgamOptions.labelsPath} was provided. */
  getNvramImage(): Uint8Array {
    if (!this.configureEnabled) {
      throw new Error("getNvramImage() requires labelsPath (ap6 amalgam with embedded I²C)");
    }
    return new Uint8Array(this.nvramMock.image);
  }

  /** Override PCF8583 NVRAM bytes (e.g. set a tube-on precondition). */
  setNvramBytes(overrides: PartialNvramImage): void {
    if (!this.configureEnabled) {
      throw new Error("setNvramBytes() requires labelsPath (ap6 amalgam with embedded I²C)");
    }
    this.nvramMock.setBytes(overrides);
  }

  reset(): void {
    Object.assign(this.serv7Store, createDefaultClassicServ7Store());
    this.loadRomImageIntoCpu();
    this.mos.reinstallStubs(this.cpu);
    this.installServ7Stubs();
    this.mos.resetCaptures();
    this.romManager.prepareWorkspace();
    this.plus1.prepareWorkspace();
    this.romManager.installBreakStubs();
  }

  private installServ7Stubs(): void {
    if (this.configureEnabled) {
      this.nvramMock.loadImage(createDefaultConfigureNvramImage());
      this.mos.stubOsbyteDefault(() => ({ a: 0, carry: false }));
      installConfigureWorkspaceStubs(this.cpu);
      this.reinstallConfigureMocks();
      installNvramServ7OsbyteStubs(this.mos, () => this.nvramMock.image);
      return;
    }
    installClassicServ7OsbyteStubs(this.mos, this.serv7Store);
  }

  private reinstallConfigureMocks(): void {
    this.nvramMock.detach(this.cpu);
    this.readKeySwitchesStub.detach(this.cpu);
    if (this.framReadEntry !== null && this.framWriteEntry !== null) {
      this.nvramMock.install(this.cpu, this.framReadEntry, this.framWriteEntry);
      if (this.readKeySwitchesEntry !== null) {
        this.readKeySwitchesStub.install(this.cpu, this.readKeySwitchesEntry);
      }
    }
  }

  private loadRomImageIntoCpu(): void {
    fillMemory(this.cpu, 0xea);
    for (let i = 0; i < this.rom.length; i++) {
      this.cpu.writemem(this.romBase + i, this.rom[i]!);
    }
    this.cpu.writemem(RETURN_TRAMPOLINE, 0xea);
    // Plus 1 Serv1 skips self-disable when &FFB2 = &40 (Electron).
    this.cpu.writemem(MOS_MACHINE_TYPE, 0x40);
    this.cpu.halted = false;
  }
}
