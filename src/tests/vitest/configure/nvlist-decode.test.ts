import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_CONFIGURE_NVRAM,
  I2CBeebRomTestHarness,
  NVR_DefaultRoms,
  NVR_KeyRptDelay,
  NVR_TubeSerialPrint,
  NVR_VDUSettings,
  nvramBaudRate,
  nvramFile,
  nvramLang,
  nvramMode,
  nvramTubeEnabled,
  requireConfigureFolderVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfigureFolderVariants();

/** Read one NVRAM byte the way NVList.bas PROCreadall does (lines 30–31). */
function nvlistReadByte(harness: I2CBeebRomTestHarness, addr: number): number {
  const result = harness.invokeUnknownOsbyte({ code: 161, x: addr });
  expect(result.claimed).toBe(true);
  return result.y;
}

describe("NVList.bas decode and dump (#33)", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      harness.mockConfigure();
    });

    /**
     * Replicates `src/tests/native/NVList.bas` PROCreadall (lines 30–31): full
     * `FOR X%=255 TO 0 STEP -1` bulk read into `nv%` array.
     */
    it("PROCreadall bulk read returns every byte of the NVRAM mock (NVList.bas lines 30–31)", () => {
      // Given — factory NVRAM image behind FRAM_readByte
      const image = harness.getNvramImage();

      // When / Then — each address matches nv%?X% after USR&FFF4 read loop
      for (let addr = 0; addr <= 255; addr++) {
        expect(nvlistReadByte(harness, addr)).toBe(image[addr]! & 0xff);
      }
    });

    /**
     * Replicates `src/tests/native/NVList.bas` PROCnvdump (lines 90–92): hex/char
     * dump uses the same PROCreadall buffer — spot-check boundary rows 0 and 240.
     */
    it("PROCnvdump rows match bulk-read bytes at 0 and 240 (NVList.bas lines 90–92)", () => {
      // Given — NVList.bas PROCnvdump calls PROCreadall first (line 90)
      const image = harness.getNvramImage();

      // When / Then — hex row at N%=0 and N%=240 (FOR N%=0 TO 255 STEP 16)
      for (const addr of [0, 240]) {
        expect(nvlistReadByte(harness, addr)).toBe(image[addr]! & 0xff);
      }
    });

    /**
     * Replicates `src/tests/native/NVList.bas` PROCnvshow (lines 36–67): station,
     * FS/PS, FILE/LANG, unplug bitmap, MODE, delay/rate, TUBE/baud from configure
     * NVRAM addresses 0–16 (Electron configure subset — skips Beeb-only TV/ANFS fields).
     */
    it("PROCnvshow configure-band fields decode from OSBYTE 161 (NVList.bas lines 36–67)", () => {
      // Given — NVList.bas lines 34–35 after PROCreadall
      const image = harness.getNvramImage();

      // When / Then — line 36: Station Number (?nv% / addr 0)
      expect(nvlistReadByte(harness, 0)).toBe(image[0]! & 0xff);

      // Lines 37–38: File server nv%?2 "." nv%?1; Printer server nv%?4 "." nv%?3
      expect(nvlistReadByte(harness, 1)).toBe(image[1]! & 0xff);
      expect(nvlistReadByte(harness, 2)).toBe(image[2]! & 0xff);
      expect(nvlistReadByte(harness, 3)).toBe(image[3]! & 0xff);
      expect(nvlistReadByte(harness, 4)).toBe(image[4]! & 0xff);

      // Lines 39–40: FILE/LANG at nv%?5
      const roms = nvlistReadByte(harness, NVR_DefaultRoms);
      expect(nvramFile(image)).toBe(roms & 0x0f);
      expect(nvramLang(image)).toBe((roms & 0xf0) >> 4);

      // Line 41 PROCplug (nv%?6/7) — covered by full bulk read test above

      // Lines 49–50: Screen MODE at nv%?10
      expect(nvramMode(image)).toBe(nvlistReadByte(harness, NVR_VDUSettings) & 0x07);

      // Lines 55–56: Key repeat delay / rate (NVList.bas)
      expect(nvlistReadByte(harness, NVR_KeyRptDelay)).toBe(image[NVR_KeyRptDelay]! & 0xff);
      expect(nvlistReadByte(harness, 13)).toBe(image[13]! & 0xff);

      // Lines 58–60: Tube enabled, baud index at nv%?15
      const tubeByte = nvlistReadByte(harness, NVR_TubeSerialPrint);
      expect(tubeByte).toBe(image[NVR_TubeSerialPrint]! & 0xff);
      expect(nvramTubeEnabled(image)).toBe((tubeByte & 0x01) !== 0);
      expect(nvramBaudRate(image)).toBe(((tubeByte & 0x1c) >> 2) + 1);
    });
  });
});
