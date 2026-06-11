/**
 * ROM Manager / Plus 1 LANG/TUBE persistence on ap6-classic (`bin/buildap6/out/ap6-classic.rom`).
 * Persistent LANG/TUBE via NVRAM store shadow (OSBYTE 161/162) — no *CONFIGURE star command in ROM.
 * Run via `npm run test:classic-only` or `test:classic-composite`.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  Ap6ClassicAmalgamSession,
  Plus1SupportTestHarness,
  RomManagerTestHarness,
  MOS_BREAK_TYPE,
  MOS_LANG_ROM_TYPE,
  MOS_TUBE_ENABLE,
  ROM_MANAGER_L0D6D,
  expectByte,
  readNVRAMStore,
  requireClassicCompositeVariants,
  writeNVRAMStore,
  writeClassicServ7TubeEnabled,
} from "../../../../../bin/rom-unittest/src/index.js";

const variants = requireClassicCompositeVariants();

describe("LANG/TUBE persistence (ROM Manager / Plus 1 in ap6-classic amalgam)", () => {
  describe.each(variants)("$label ($id)", (variant) => {
    let session: Ap6ClassicAmalgamSession;
    let romManager: RomManagerTestHarness;
    let plus1: Plus1SupportTestHarness;

    beforeEach(() => {
      // Given — ap6-classic.rom; NVRAM store shadow (OSBYTE 161/162, no embedded I²C FRAM)
      session = new Ap6ClassicAmalgamSession({ romPath: variant.path });
      romManager = session.romManager;
      plus1 = session.plus1;
      session.reset();
    });

    it("NVRAM store LANG 12 → break → 12; *LANG 11 → break → 11; NVRAM store LANG 10 → break → 11; power-on → 10", () => {
      // Given — session LANG 12 at &0D6D; NVRAM store holds LANG 12
      romManager.setSessionLang(12);
      writeNVRAMStore(session.serv7Store, 12);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0c);
      expect(readNVRAMStore(session.serv7Store)).toBe(12);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 0);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0c);
      expect(romManager.hasNvramLangRead()).toBe(false);

      // When — *LANG 11 (session override in &0D6D only)
      const lang11 = romManager.invokeCommand({ commandText: "LANG 11\r", y: 0 });

      // Then — &0D6D = &0B; NVRAM store LANG still 12
      expect(lang11.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(readNVRAMStore(session.serv7Store)).toBe(12);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(romManager.hasNvramLangRead()).toBe(false);

      // When — NVRAM store LANG 10 while session is still 11
      writeNVRAMStore(session.serv7Store, 10);
      expect(readNVRAMStore(session.serv7Store)).toBe(10);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(romManager.hasNvramLangRead()).toBe(false);

      // When — cold boot (Serv10 GetTubeAndLang, &028D = 1)
      romManager.mos.resetCaptures();
      const powerOn = romManager.invokePowerOn();

      // Then — &0D6D reloaded from NVRAM store: LANG 10
      expect(powerOn.reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0a);
      expect(romManager.hasNvramLangRead()).toBe(true);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*TUBE OFF is session-only; NVRAM store tube off persists after power-on", () => {
      // Given — NVRAM store tube on; session tube enabled (b5 clear)
      writeClassicServ7TubeEnabled(session.serv7Store, true);
      romManager.setSessionTubeDisabled(false);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0, { mask: 0x20 });

      // When — *TUBE OFF (sets &0D6D b5 only)
      const tubeOff = romManager.invokeCommand({ commandText: "TUBE OFF\r", y: 0 });
      expect(tubeOff.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });

      // When — NVRAM store tube off while session b5 still set
      writeClassicServ7TubeEnabled(session.serv7Store, false);

      romManager.mos.resetCaptures();
      expect(romManager.invokeCtrlBreak().reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });

      // When — power-on reloads tube state from NVRAM store
      expect(romManager.invokePowerOn().reason).toBe("return");
      expectByte(romManager, MOS_BREAK_TYPE, 1);
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*LANG does not call OSBYTE 162", () => {
      writeNVRAMStore(session.serv7Store, 10);
      romManager.setSessionLang(12);

      // When — *LANG 11
      const result = romManager.invokeCommand({ commandText: "LANG 11\r", y: 0 });

      // Then — &0D6D = &0B; NVRAM store LANG unchanged; no OSBYTE 162
      expect(result.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x0b);
      expect(readNVRAMStore(session.serv7Store)).toBe(10);
      expect(romManager.mos.getOsbyteCalls(162)).toHaveLength(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*TUBE OFF does not call OSBYTE 162", () => {
      romManager.setSessionTubeDisabled(false);

      // When — *TUBE OFF
      const result = romManager.invokeCommand({ commandText: "TUBE OFF\r", y: 0 });

      // Then — &0D6D b5 set; no NVRAM store write
      expect(result.reason).toBe("return");
      expectByte(romManager, ROM_MANAGER_L0D6D, 0x20, { mask: 0x20 });
      expect(romManager.mos.getOsbyteCalls(162)).toHaveLength(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*LANG with no <rom> sets b7 in &0D6D", () => {
      romManager.setSessionLang(12);

      // When — *LANG with no argument
      const result = romManager.invokeCommand({ commandText: "LANG\r", y: 0 });

      // Then — b7 set in &0D6D; no NVRAM store write
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

    it("Plus1 L831C uses session L0D6D when &028D=0; reads NVRAM store LANG when &028D=1", () => {
      // Given — session LANG 11; NVRAM store LANG 10; both ROMs in table
      writeNVRAMStore(session.serv7Store, 10);
      plus1.setLanguageRom(10, MOS_LANG_ROM_TYPE);
      plus1.setLanguageRom(11, MOS_LANG_ROM_TYPE);
      plus1.setSessionLang(11);
      expectByte(plus1, ROM_MANAGER_L0D6D, 0x0b);

      // When — soft break path (L831C, &028D = 0)
      plus1.setBreakType(0);
      plus1.mos.resetCaptures();
      const softBreak = plus1.invokeRestoreRomTableLang();
      expect(softBreak.reason).toBe("return");
      expect(plus1.getSelectedLangRom()).toBe(11);
      expect(plus1.hasNvramLangRead()).toBe(false);

      // When — power-on path reloads LANG from NVRAM store (&028D = 1)
      plus1.setBreakType(1);
      plus1.mos.resetCaptures();
      const powerOn = plus1.invokeRestoreRomTableLang();
      expect(powerOn.reason).toBe("return");
      expect(plus1.getSelectedLangRom()).toBe(10);
      expect(plus1.hasNvramLangRead()).toBe(true);
      expect(plus1.mos.unexpected).toHaveLength(0);
    });
  });
});
