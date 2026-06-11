/**
 * Isolated *CONFIGURE FRAM writes — `fixtures/ap6` (`dist/ap6.rom` + relocated I²C labels).
 * Run via `npm run test:composite`.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  NVR_DefaultRoms,
  NVR_TubeSerialPrint,
  I2CBeebRomTestHarness,
  expectNvramByte,
  nvramLang,
  nvramTubeEnabled,
  requireCompositeRomVariants,
} from "../../../../../bin/rom-unittest/src/index.js";

const variants = requireCompositeRomVariants();

describe("LANG/TUBE NVRAM persistence (*CONFIGURE via embedded I²C in ap6 amalgam)", () => {
  describe.each(variants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      // Given — embedded I²C slice in ap6.rom with PCF8583 NVRAM mock
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      harness.mockRtc();
      harness.mockConfigure();
    });

    it("*CONFIGURE NOTUBE clears NVRAM address 15 bit 0", () => {
      expectNvramByte(harness.getNvramImage(), NVR_TubeSerialPrint, 1, { mask: 0x01 });

      // When — *CONFIGURE NOTUBE
      const result = harness.invokeCommand({ commandText: "CONFIGURE NOTUBE\r", y: 0 });

      // Then — PCF8583 byte 15 bit 0 cleared
      expect(result.reason).toBe("return");
      expectNvramByte(harness.getNvramImage(), NVR_TubeSerialPrint, 0, { mask: 0x01 });
      expect(nvramTubeEnabled(harness.getNvramImage())).toBe(false);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*CONFIGURE TUBE sets NVRAM address 15 bit 0", () => {
      harness.invokeCommand({ commandText: "CONFIGURE NOTUBE\r", y: 0 });
      harness.mos.resetCaptures();

      // When — *CONFIGURE TUBE after NOTUBE
      const result = harness.invokeCommand({ commandText: "CONFIGURE TUBE\r", y: 0 });

      // Then — PCF8583 byte 15 bit 0 set
      expect(result.reason).toBe("return");
      expectNvramByte(harness.getNvramImage(), NVR_TubeSerialPrint, 1, { mask: 0x01 });
      expect(nvramTubeEnabled(harness.getNvramImage())).toBe(true);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*CONFIGURE LANG writes high nibble of NVRAM address 5", () => {
      // When — *CONFIGURE LANG A (ROM slot 10)
      const result = harness.invokeCommand({ commandText: "CONFIGURE LANG A\r", y: 0 });

      // Then — PCF8583 byte 5 high nibble = A
      expect(result.reason).toBe("return");
      expectNvramByte(harness.getNvramImage(), NVR_DefaultRoms, 0xa0, { mask: 0xf0 });
      expect(nvramLang(harness.getNvramImage())).toBe(0x0a);
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});
