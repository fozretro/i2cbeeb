/**
 * ROM Manager / Plus 1 LANG/TUBE persistence on ap6 (`dist/ap6.rom`, embedded I²C).
 * Real *CONFIGURE via embedded I²C; amalgam dispatch via composite `$8003`.
 * Run via `npm run test:composite`.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  NVR_DefaultRoms,
  NVR_TubeSerialPrint,
  Ap6ClassicAmalgamSession,
  Plus1SupportTestHarness,
  RomManagerTestHarness,
  MOS_BREAK_TYPE,
  MOS_LANG_ROM_TYPE,
  MOS_TUBE_ENABLE,
  ROM_MANAGER_L0D6D,
  expectByte,
  expectNvramByte,
  nvramLang,
  nvramTubeEnabled,
  requireCompositeRomVariants,
} from "../../../../../bin/rom-unittest/src/index.js";

const variants = requireCompositeRomVariants();

describe("LANG/TUBE persistence (ROM Manager / Plus 1 in ap6 amalgam)", () => {
  describe.each(variants)("$label ($id)", (variant) => {
    let session: Ap6ClassicAmalgamSession;
    let romManager: RomManagerTestHarness;
    let plus1: Plus1SupportTestHarness;

    beforeEach(() => {
      // Given — ap6.rom amalgam with embedded I²C FRAM hooks + PCF8583 NVRAM
      session = new Ap6ClassicAmalgamSession({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      romManager = session.romManager;
      plus1 = session.plus1;
      session.reset();
    });

    it("*CONFIGURE LANG 12 → break → 12; *LANG 11 → break → 11; *CONFIGURE LANG 10 → break → 11; power-on → 10", () => {
      // Given — session LANG 12 at &0D6D (typical post-boot state)
      romManager.setSessionLang(12);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0c);

      // When — *CONFIGURE LANG 12 (hex C)
      const configure12 = romManager.invokeCommand({ commandText: "CONFIGURE LANG C\r", y: 0 });

      // Then — NVRAM addr 5 holds LANG 12; &0D6D unchanged (CONFIGURE does not touch session)
      expect(configure12.reason).toBe("return");
      expectNvramByte(session.getNvramImage(), NVR_DefaultRoms, 0xc0, { mask: 0xf0 });
      expect(nvramLang(session.getNvramImage())).toBe(12);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0c);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 0);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0c);
      expect(romManager.hasNvramLangRead()).toBe(false);

      // When — *LANG 11 (session override in &0D6D only)
      const lang11 = romManager.invokeCommand({ commandText: "LANG 11\r", y: 0 });

      // Then — &0D6D = &0B; NVRAM addr 5 still LANG 12
      expect(lang11.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expectNvramByte(session.getNvramImage(), NVR_DefaultRoms, 0xc0, { mask: 0xf0 });
      expect(nvramLang(session.getNvramImage())).toBe(12);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(romManager.hasNvramLangRead()).toBe(false);

      // When — *CONFIGURE LANG 10 (hex A) while session is still 11
      const configure10 = romManager.invokeCommand({ commandText: "CONFIGURE LANG A\r", y: 0 });

      // Then — NVRAM addr 5 = LANG 10; Ctrl-Break keeps &0D6D at 11
      expect(configure10.reason).toBe("return");
      expectNvramByte(session.getNvramImage(), NVR_DefaultRoms, 0xa0, { mask: 0xf0 });
      expect(nvramLang(session.getNvramImage())).toBe(10);
      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(romManager.hasNvramLangRead()).toBe(false);

      // When — cold boot (Serv10 GetTubeAndLang, &028D = 1)
      romManager.mos.resetCaptures();
      const powerOn = romManager.invokePowerOn();

      // Then — &0D6D reloaded from NVRAM: LANG 10
      expect(powerOn.reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0a);
      expect(romManager.hasNvramLangRead()).toBe(true);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*TUBE OFF is session-only; *CONFIGURE NOTUBE persists after power-on", () => {
      // Given — NVRAM addr 15 bit 0 set (tube on); &0D6D tube enabled (b5 clear)
      expectNvramByte(session.getNvramImage(), NVR_TubeSerialPrint, 1, { mask: 0x01 });
      expect(nvramTubeEnabled(session.getNvramImage())).toBe(true);
      romManager.setSessionTubeDisabled(false);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0, { mask: 0x20 });

      // When — *TUBE OFF (sets &0D6D b5 only)
      const tubeOff = romManager.invokeCommand({ commandText: "TUBE OFF\r", y: 0 });
      expect(tubeOff.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });
      expectNvramByte(session.getNvramImage(), NVR_TubeSerialPrint, 1, { mask: 0x01 });

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });

      // When — *CONFIGURE NOTUBE (NVRAM addr 15 bit 0 clear)
      const configureNotube = romManager.invokeCommand({ commandText: "CONFIGURE NOTUBE\r", y: 0 });
      expect(configureNotube.reason).toBe("return");
      expectNvramByte(session.getNvramImage(), NVR_TubeSerialPrint, 0, { mask: 0x01 });
      expect(nvramTubeEnabled(session.getNvramImage())).toBe(false);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });

      // When — power-on reloads tube state from NVRAM into &0D6D
      expect(romManager.invokePowerOn().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*LANG does not call OSBYTE 162", () => {
      romManager.invokeCommand({ commandText: "CONFIGURE LANG A\r", y: 0 });
      romManager.setSessionLang(12);

      // When — *LANG 11
      const result = romManager.invokeCommand({ commandText: "LANG 11\r", y: 0 });

      // Then — &0D6D = &0B; PCF8583 byte 5 still LANG 10; no NVRAM write
      expect(result.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(nvramLang(session.getNvramImage())).toBe(10);
      expect(romManager.mos.getOsbyteCalls(162)).toHaveLength(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*TUBE OFF does not call OSBYTE 162", () => {
      romManager.setSessionTubeDisabled(false);

      // When — *TUBE OFF
      const result = romManager.invokeCommand({ commandText: "TUBE OFF\r", y: 0 });

      // Then — &0D6D b5 set; no Serv7 write
      expect(result.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });
      expect(romManager.mos.getOsbyteCalls(162)).toHaveLength(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*LANG with no <rom> sets b7 in &0D6D", () => {
      romManager.setSessionLang(12);

      // When — *LANG with no argument
      const result = romManager.invokeCommand({ commandText: "LANG\r", y: 0 });

      // Then — b7 set in &0D6D; no Serv7 write
      expect(result.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x80, { mask: 0x80 });
      expect(romManager.mos.getOsbyteCalls(162)).toHaveLength(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("Serv1 leaves &027A alone when tube enabled in L0D6D", () => {
      // Given — tube enabled in session; MOS tube flag enabled
      romManager.setSessionTubeDisabled(false);
      romManager.writeMemory(MOS_TUBE_ENABLE, 1);

      // When — service &1 reset processing
      expect(romManager.invokeServ1().reason).toBe("return");

      // Then — Serv1 did not clear &027A
      expectByte(romManager, MOS_TUBE_ENABLE, 1);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("Plus1 L831C uses session L0D6D when &028D=0; reads NVRAM LANG when &028D=1", () => {
      // Given — session LANG 11; NVRAM LANG 10; both ROMs in table
      romManager.invokeCommand({ commandText: "CONFIGURE LANG A\r", y: 0 });
      plus1.setLanguageRom(10, MOS_LANG_ROM_TYPE);
      plus1.setLanguageRom(11, MOS_LANG_ROM_TYPE);
      plus1.setSessionLang(11);
      expectByte(plus1, ROM_MANAGER_L0D6D, 0x0b);
      expect(nvramLang(session.getNvramImage())).toBe(10);

      // When — soft break path (L831C, &028D = 0)
      plus1.setBreakType(0);
      plus1.mos.resetCaptures();
      const softBreak = plus1.invokeRestoreRomTableLang();
      expect(softBreak.reason).toBe("return");
      expect(plus1.getSelectedLangRom()).toBe(11);
      expect(plus1.hasNvramLangRead()).toBe(false);

      // When — power-on path reloads LANG from NVRAM (&028D = 1)
      plus1.setBreakType(1);
      plus1.mos.resetCaptures();
      const powerOn = plus1.invokeRestoreRomTableLang();
      expect(powerOn.reason).toBe("return");
      expect(plus1.getSelectedLangRom()).toBe(10);
      expect(plus1.hasNvramLangRead()).toBe(true);
      expect(plus1.mos.unexpected).toHaveLength(0);
    });

    it("Plus1 L831C uses session L0D6D on hard BREAK (&028D=2)", () => {
      romManager.invokeCommand({ commandText: "CONFIGURE LANG A\r", y: 0 });
      plus1.setLanguageRom(10, MOS_LANG_ROM_TYPE);
      plus1.setLanguageRom(11, MOS_LANG_ROM_TYPE);
      plus1.setSessionLang(11);
      expect(nvramLang(session.getNvramImage())).toBe(10);

      plus1.setBreakType(2);
      plus1.mos.resetCaptures();
      const hardBreak = plus1.invokeRestoreRomTableLang();
      expect(hardBreak.reason).toBe("return");
      expect(plus1.getSelectedLangRom()).toBe(11);
      expect(plus1.hasNvramLangRead()).toBe(false);
      expect(plus1.mos.unexpected).toHaveLength(0);
    });

    it("NVRAM unplug map applied on power-on via Serv1 after Serv10 LANG/TUBE", () => {
      const ROM_D = 13;

      const unplug = romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 });
      expect(unplug.reason).toBe("return");
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      const powerOn = romManager.invokePowerOn();

      expect(powerOn.reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, romManager.romTable + ROM_D, 0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("power-on with R held clears unplug map after SET_Reset on Serv1", () => {
      const ROM_D = 13;

      const unplug = romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 });
      expect(unplug.reason).toBe("return");
      expectByte(romManager, romManager.romTable + ROM_D, 0);
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      const powerOnR = romManager.invokePowerOnWithR();

      expect(powerOnR.reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, romManager.romTable + ROM_D, 0x0b);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("Ctrl-Break still applies unplug map via Serv10", () => {
      const ROM_D = 13;

      const unplug = romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 });
      expect(unplug.reason).toBe("return");
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      const ctrlBreak = romManager.invokeCtrlBreak();

      expect(ctrlBreak.reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 0);
      expectByte(romManager, romManager.romTable + ROM_D, 0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*UNPLUG D then simulated power-on without R then Ctrl-Break keeps ROM D hidden", () => {
      const ROM_D = 13;

      expect(romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 }).reason).toBe("return");
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      expect(romManager.invokePowerOn().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, romManager.romTable + ROM_D, 0);

      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);
      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 0);
      expectByte(romManager, romManager.romTable + ROM_D, 0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*UNPLUG D then simulated power-on with R held then Ctrl-Break keeps ROM D visible", () => {
      const ROM_D = 13;

      expect(romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 }).reason).toBe("return");
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      expect(romManager.invokePowerOnWithR().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 0);
      expectByte(romManager, romManager.romTable + ROM_D, 0x0b);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*UNPLUG D then *INSERT D then simulated power-on without R keeps ROM D visible", () => {
      const ROM_D = 13;

      expect(romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 }).reason).toBe("return");
      expectByte(romManager, romManager.romTable + ROM_D, 0);

      expect(romManager.invokeCommand({ commandText: "INSERT D\r", y: 0 }).reason).toBe("return");
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      expect(romManager.invokePowerOn().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, romManager.romTable + ROM_D, 0x0b);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*UNPLUG D then hard BREAK (&028D=2) applies unplug map via Serv10", () => {
      const ROM_D = 13;

      expect(romManager.invokeCommand({ commandText: "UNPLUG D\r", y: 0 }).reason).toBe("return");
      romManager.writeMemory(romManager.romTable + ROM_D, 0x0b);

      romManager.mos.resetCaptures();
      expect(romManager.invokeHardBreak().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 2);
      expectByte(romManager, romManager.romTable + ROM_D, 0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });
  });
});
