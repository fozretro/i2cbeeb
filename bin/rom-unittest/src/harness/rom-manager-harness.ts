import { ZP } from "../bbc/mos.js";
import { writeCommandLine, type CommandCallOptions, type ServiceCallOptions } from "./rom-test-harness.js";
import {
  Ap6SidecarHarness,
  MOS_BREAK_TYPE,
  MOS_TUBE_ENABLE,
  ROM_MANAGER_L0D6D,
  type Ap6AmalgamModuleBinding,
  type Ap6SidecarHarnessOptions,
} from "./ap6-sidecar-harness.js";

export { MOS_BREAK_TYPE, MOS_LANGUAGE_ROM_NUMBER, MOS_TUBE_ENABLE, ROM_MANAGER_L0D6D } from "./ap6-sidecar-harness.js";
export type { Ap6SidecarHarnessOptions as RomManagerHarnessOptions, Ap6AmalgamModuleBinding };

export class RomManagerTestHarness extends Ap6SidecarHarness {
  constructor(options: Omit<Ap6SidecarHarnessOptions, "romSlot"> & { romSlot?: number; romPath?: string }) {
    super({ ...options, romSlot: options.romSlot ?? 12 });
  }

  static forAmalgamModule(binding: Ap6AmalgamModuleBinding): RomManagerTestHarness {
    return new RomManagerTestHarness({ amalgam: binding, romSlot: binding.romSlot });
  }

  setSessionTubeDisabled(disabled: boolean): void {
    const current = this.readMemory(ROM_MANAGER_L0D6D);
    this.writeMemory(ROM_MANAGER_L0D6D, disabled ? current | 0x20 : current & ~0x20);
  }

  invokeCommand(options: CommandCallOptions) {
    return this.invokeService({
      serviceType: 4,
      commandText: options.commandText,
      y: options.y ?? 0,
      commandLine: options.commandLine,
    });
  }

  invokeService(options: ServiceCallOptions) {
    const cmdAddr = options.commandLine ?? 0x0900;
    const text = options.commandText ?? "\r";
    writeCommandLine(this.cpu, cmdAddr, text);
    this.cpu.writemem(ZP.CLI, cmdAddr & 0xff);
    this.cpu.writemem(ZP.CLI + 1, (cmdAddr >> 8) & 0xff);
    return this.invokeAtServiceEntry(options.serviceType, options.x ?? this.romSlot, options.y ?? 0);
  }

  installBreakStubs(): void {
    this.mos.stubOsbyte(0x79, ({ x }) => (x === 0xb3 ? { x: 0x33 } : {}));
    this.mos.stubOsbyte(0x7a, () => ({ x: 0 }));
    this.mos.stubOsbyte(0x78, () => ({}));
  }

  installRKeyStub(): void {
    this.mos.stubOsbyte(0x79, ({ x }) => (x === 0xb3 ? { x: 0xb3 } : {}));
    this.mos.stubOsbyte(0x7a, () => ({ x: 0 }));
    this.mos.stubOsbyte(0x78, () => ({}));
  }

  invokeCtrlBreak() {
    this.installBreakStubs();
    this.setBreakType(0);
    this.writeMemory(ZP.OSW_A, 0);
    this.writeMemory(ZP.OSW_X, 0);
    this.writeMemory(ZP.OSW_Y, 0);
    return this.invokeService({ serviceType: 0x10, y: 0, commandText: "\r" });
  }

  invokeHardBreak() {
    this.installBreakStubs();
    this.setBreakType(2);
    this.writeMemory(ZP.OSW_A, 0);
    this.writeMemory(ZP.OSW_X, 0);
    this.writeMemory(ZP.OSW_Y, 0);
    return this.invokeService({ serviceType: 0x10, y: 0, commandText: "\r" });
  }

  invokePowerOn() {
    this.installBreakStubs();
    this.setBreakType(1);
    this.writeMemory(0x024b, 0x00);
    this.writeMemory(ZP.OSW_A, 0);
    this.writeMemory(ZP.OSW_X, 0);
    this.writeMemory(ZP.OSW_Y, 0);
    const serv10 = this.invokeService({ serviceType: 0x10, y: 0, commandText: "\r" });
    if (serv10.reason !== "return") {
      return serv10;
    }
    return this.invokeServ1();
  }

  invokePowerOnWithR() {
    this.installRKeyStub();
    this.setBreakType(1);
    this.writeMemory(0x024b, 0x00);
    this.writeMemory(ZP.OSW_A, 0);
    this.writeMemory(ZP.OSW_X, 0);
    this.writeMemory(ZP.OSW_Y, 0);
    const serv10 = this.invokeService({ serviceType: 0x10, y: 0, commandText: "\r" });
    if (serv10.reason !== "return") {
      return serv10;
    }
    return this.invokeServ1();
  }

  invokeServ1() {
    this.seedServ1Vectors();
    return this.invokeService({ serviceType: 1, y: 0, commandText: "\r" });
  }

  /**
   * Service 3 (auto-boot): default filing system + printer destination.
   * Seeds the break type at &028D (read directly, as Serv1/Serv10 do), and
   * stubs OSBYTE &7A (key scan, &FF = no key held) and &05 (printer
   * destination) then dispatches service 3.
   */
  invokeServ3(options: { breakType?: 0 | 1 | 2; keyHeld?: boolean } = {}) {
    const keyHeld = options.keyHeld ?? false;
    this.setBreakType(options.breakType ?? 2);
    this.mos.stubOsbyte(0x7a, () => ({ x: keyHeld ? 0x00 : 0xff }));
    this.mos.stubOsbyte(0x05, () => ({}));
    return this.invokeService({ serviceType: 3, y: 0, commandText: "\r" });
  }

  protected override seedWorkspace(): void {
    this.seedRomTable();
    this.setBreakType(2);
  }

  private seedServ1Vectors(): void {
    const vectorBase = 0x0500;
    for (let offset = 0; offset <= 0x21; offset++) {
      this.writeMemory(vectorBase + offset, 0xea);
    }
    this.writeMemory(0xffb7, vectorBase & 0xff);
    this.writeMemory(0xffb8, (vectorBase >> 8) & 0xff);
  }
}
