/**
 * ROM Manager service 3 (auto-boot) on `fixtures/ap6` (`dist/ap6.rom` + relocated I²C labels).
 * Restore *FX 5 printer destination (NVRAM 15 b5-b7) on hard break, and redirect
 * MOS's service-3 ROM scan to the configured default filing system (NVRAM 5 b0-b3)
 * via OS_ROMNum (&F4).
 *
 * Dispatched through the amalgam's `$8003` chain (Plus 1 → I²C → ROM Manager →
 * TUBEelk → AP6Count), so this also exercises that the redirect's &F4 write does
 * not disturb the chain (siblings ignore service 3). The cross-bank jump into the
 * selected FS ROM is MOS behaviour and is validated on jsbeeb/hardware, not here.
 * Run via `npm run test:composite`.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  NVR_DefaultRoms,
  NVR_TubeSerialPrint,
  Ap6ClassicAmalgamSession,
  RomManagerTestHarness,
  expectByte,
  nvramFile,
  nvramPrinter,
  requireCompositeRomVariants,
} from "../../../../../bin/rom-unittest/src/index.js";

const OS_ROMNUM = 0xf4;
const variants = requireCompositeRomVariants();

describe("Default FS + printer (ROM Manager service 3 via amalgam $8003)", () => {
  describe.each(variants)("$label ($id)", (variant) => {
    let session: Ap6ClassicAmalgamSession;
    let romManager: RomManagerTestHarness;

    beforeEach(() => {
      session = new Ap6ClassicAmalgamSession({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      romManager = session.romManager;
      session.reset();
    });

    it("hard break, no key held: redirects OS_ROMNum to default FS when FILE < our slot", () => {
      // Given — NVRAM byte 5 FILE = 5 (low nibble), LANG = A (high nibble)
      session.setNvramBytes({ [NVR_DefaultRoms]: 0xa5 });
      romManager.mos.resetCaptures();

      // When — service 3 on a hard break with no key held
      const result = romManager.invokeServ3({ breakType: 2, keyHeld: false });

      // Then — OS_ROMNum redirected to FILE+1 (MOS decrements to FILE next), unclaimed A=3
      expect(result.reason).toBe("return");
      expectByte(romManager, OS_ROMNUM, 6);
      expect(romManager.registers().a).toBe(3);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("does not redirect when default FILE >= our slot (already offered)", () => {
      // Given — FILE = 15, which is above the amalgam slot (12)
      session.setNvramBytes({ [NVR_DefaultRoms]: 0x0f });
      romManager.mos.resetCaptures();

      const result = romManager.invokeServ3({ breakType: 2, keyHeld: false });

      // Then — OS_ROMNum left untouched
      expect(result.reason).toBe("return");
      expectByte(romManager, OS_ROMNUM, session.romSlot);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("key held skips default FS selection", () => {
      session.setNvramBytes({ [NVR_DefaultRoms]: 0x05 });
      romManager.mos.resetCaptures();

      const result = romManager.invokeServ3({ breakType: 2, keyHeld: true });

      expect(result.reason).toBe("return");
      expectByte(romManager, OS_ROMNUM, session.romSlot);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("soft break still applies the default FS redirect", () => {
      // Only the printer restore is break-type gated; the FS redirect runs on
      // soft break too (the key-held gate is the real guard).
      session.setNvramBytes({ [NVR_DefaultRoms]: 0x05 });
      romManager.mos.resetCaptures();

      const result = romManager.invokeServ3({ breakType: 0, keyHeld: false });

      expect(result.reason).toBe("return");
      expectByte(romManager, OS_ROMNUM, 6);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("hard break restores *FX 5 printer destination from NVRAM 15 b5-b7", () => {
      // Given — byte 15 PRINT field (b5-b7) = 3
      session.setNvramBytes({ [NVR_TubeSerialPrint]: 0x60 });
      romManager.mos.resetCaptures();

      const result = romManager.invokeServ3({ breakType: 2, keyHeld: false });

      // Then — OSBYTE 5 (printer destination) called once with the decoded value
      expect(result.reason).toBe("return");
      const printerCalls = romManager.mos.getOsbyteCalls(5);
      expect(printerCalls).toHaveLength(1);
      expect(printerCalls[0]!.x).toBe(3);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("soft break does not touch the printer destination", () => {
      session.setNvramBytes({ [NVR_TubeSerialPrint]: 0x60 });
      romManager.mos.resetCaptures();

      const result = romManager.invokeServ3({ breakType: 0, keyHeld: false });

      expect(result.reason).toBe("return");
      expect(romManager.mos.getOsbyteCalls(5)).toHaveLength(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    // The cases above seed NVRAM directly to isolate the apply path. These two
    // close the loop end-to-end through the shipped amalgam: the real command
    // interpreter writes NVRAM (*CONFIGURE), then service 3 reads that same live
    // PCF8583 image and applies it — proving the write/apply bit contract holds
    // across both halves, not just within each.
    describe("end-to-end: *CONFIGURE writes NVRAM, service 3 applies it", () => {
      it("*CONFIGURE PRINT 3 then hard break drives *FX 5 with destination 3", () => {
        // When — set the printer destination via the real command interpreter
        const configure = romManager.invokeCommand({ commandText: "CONFIGURE PRINT 3\r" });

        // Then — NVRAM byte 15 b5-b7 holds 3 (write path)
        expect(configure.reason).toBe("return");
        expect(nvramPrinter(session.getNvramImage())).toBe(3);

        // When — a hard break fires service 3, reading that same NVRAM (apply path)
        romManager.mos.resetCaptures();
        const serv3 = romManager.invokeServ3({ breakType: 2, keyHeld: false });

        // Then — service 3 restores the printer destination via *FX 5
        expect(serv3.reason).toBe("return");
        const printerCalls = romManager.mos.getOsbyteCalls(5);
        expect(printerCalls).toHaveLength(1);
        expect(printerCalls[0]!.x).toBe(3);
        expect(romManager.mos.unexpected).toHaveLength(0);
      });

      it("*CONFIGURE FILE 5 then hard break redirects OS_ROMNum to the configured FS", () => {
        // When — set the default filing-system ROM via *CONFIGURE
        const configure = romManager.invokeCommand({ commandText: "CONFIGURE FILE 5\r" });

        // Then — NVRAM byte 5 low nibble (FILE) holds 5 (write path)
        expect(configure.reason).toBe("return");
        expect(nvramFile(session.getNvramImage())).toBe(5);

        // When — service 3 on a hard break with no key held (apply path)
        romManager.mos.resetCaptures();
        const serv3 = romManager.invokeServ3({ breakType: 2, keyHeld: false });

        // Then — MOS scan redirected to FILE+1 (decrements to FILE=5 next), unclaimed A=3
        expect(serv3.reason).toBe("return");
        expectByte(romManager, OS_ROMNUM, 6);
        expect(romManager.registers().a).toBe(3);
        expect(romManager.mos.unexpected).toHaveLength(0);
      });
    });
  });
});
