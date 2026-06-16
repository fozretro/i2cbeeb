/**
 * Isolated *CONFIGURE FRAM writes — `fixtures/ap6` (`dist/ap6.rom` + relocated I²C labels).
 * Dispatched through the amalgam's natural `$8003` service entry (SMJoin chaining
 * forwards to the embedded I²C slice) — the same path real hardware/MOS uses.
 * Run via `npm run test:composite`.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  NVR_DefaultRoms,
  NVR_TubeSerialPrint,
  Ap6ClassicAmalgamSession,
  RomManagerTestHarness,
  expectNvramByte,
  nvramLang,
  nvramTubeEnabled,
  requireCompositeRomVariants,
} from "../../../../../bin/rom-unittest/src/index.js";

const variants = requireCompositeRomVariants();

describe("LANG/TUBE NVRAM persistence (*CONFIGURE via amalgam $8003 dispatch)", () => {
  describe.each(variants)("$label ($id)", (variant) => {
    let session: Ap6ClassicAmalgamSession;
    let romManager: RomManagerTestHarness;

    beforeEach(() => {
      // Given — ap6.rom amalgam entered at $8003; SMJoin chain reaches the
      // embedded I²C slice; PCF8583 NVRAM mock from relocated FRAM hooks
      session = new Ap6ClassicAmalgamSession({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      romManager = session.romManager;
      session.reset();
    });

    it("*CONFIGURE NOTUBE clears NVRAM address 15 bit 0", () => {
      // Given — tube enabled in NVRAM (AP6 factory default is NOTUBE, so seed
      // byte 15 with the tube-enable bit: 0x3a default | 0x01)
      session.setNvramBytes({ [NVR_TubeSerialPrint]: 0x3b });
      expectNvramByte(session.getNvramImage(), NVR_TubeSerialPrint, 1, { mask: 0x01 });

      // When — *CONFIGURE NOTUBE via the amalgam $8003 entry
      const result = romManager.invokeCommand({ commandText: "CONFIGURE NOTUBE\r", y: 0 });

      // Then — PCF8583 byte 15 bit 0 cleared
      expect(result.reason).toBe("return");
      expectNvramByte(session.getNvramImage(), NVR_TubeSerialPrint, 0, { mask: 0x01 });
      expect(nvramTubeEnabled(session.getNvramImage())).toBe(false);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*CONFIGURE TUBE sets NVRAM address 15 bit 0", () => {
      // Given — start from NOTUBE (byte 15 bit 0 clear)
      romManager.invokeCommand({ commandText: "CONFIGURE NOTUBE\r", y: 0 });
      romManager.mos.resetCaptures();

      // When — *CONFIGURE TUBE after NOTUBE
      const result = romManager.invokeCommand({ commandText: "CONFIGURE TUBE\r", y: 0 });

      // Then — PCF8583 byte 15 bit 0 set
      expect(result.reason).toBe("return");
      expectNvramByte(session.getNvramImage(), NVR_TubeSerialPrint, 1, { mask: 0x01 });
      expect(nvramTubeEnabled(session.getNvramImage())).toBe(true);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("*CONFIGURE LANG writes high nibble of NVRAM address 5", () => {
      // When — *CONFIGURE LANG A (ROM slot 10)
      const result = romManager.invokeCommand({ commandText: "CONFIGURE LANG A\r", y: 0 });

      // Then — PCF8583 byte 5 high nibble = A
      expect(result.reason).toBe("return");
      expectNvramByte(session.getNvramImage(), NVR_DefaultRoms, 0xa0, { mask: 0xf0 });
      expect(nvramLang(session.getNvramImage())).toBe(0x0a);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });
  });
});
