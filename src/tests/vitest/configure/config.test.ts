import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_CONFIGURE_NVRAM,
  NVR_KeyRptDelay,
  NVR_VDUSettings,
  NVR_MODE_MASK,
  I2CBeebRomTestHarness,
  nvramFile,
  nvramLang,
  nvramMode,
  requireConfigureFolderVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const configureVariants = requireConfigureFolderVariants();
const defaultMode = DEFAULT_CONFIGURE_NVRAM[10]! & NVR_MODE_MASK;

describe("*CONFIGURE and *STATUS (INC_CONFIG ROMs)", () => {
  describe.each(configureVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      // Given — configure ROM; RTC/NVRAM mocks at SET_DefaultsTable factory defaults
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      harness.mockRtc();
      harness.mockConfigure();
    });

    it("*STATUS MODE reports default screen mode from NVRAM", () => {
      // Given — NVR_VDUSettings holds SET_DefaultsTable mode bits (AP6: 6)
      expect(nvramMode(harness.getNvramImage())).toBe(defaultMode);

      // When — MOS service 4 dispatches *STATUS MODE
      const result = harness.invokeCommand({ commandText: "STATUS MODE\r" });

      // Then — ROM prints factory MODE from NVRAM address 10 (A=0)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(new RegExp(`MODE\\s+${defaultMode}`));
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*CONFIGURE MODE 2 stores mode 2 and *STATUS MODE confirms it", () => {
      // Given — default NVRAM has factory mode
      expect(nvramMode(harness.getNvramImage())).toBe(defaultMode);

      // When — MOS service 4 dispatches *CONFIGURE MODE 2
      const configure = harness.invokeCommand({ commandText: "CONFIGURE MODE 2\r" });

      // Then — command succeeds and NVRAM mode bits are updated
      expect(configure.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      expect(harness.getNvramImage()[NVR_VDUSettings]! & NVR_MODE_MASK).toBe(2);
      expect(harness.mos.unexpected).toHaveLength(0);

      // Given — MOS output cleared; NVRAM holds mode 2
      harness.mos.resetCaptures();

      // When — *STATUS MODE reads back the stored value
      const status = harness.invokeCommand({ commandText: "STATUS MODE\r" });

      // Then — printed status shows MODE 2
      expect(status.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/MODE\s+2/);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("accepts dot-abbreviated star commands (*CONFIG. *STAT.)", () => {
      // When — MOS requires '.' to abbreviate the star keyword (not bare prefix)
      const configure = harness.invokeCommand({ commandText: "CONFIG. MODE 1\r" });
      harness.mos.resetCaptures();
      const status = harness.invokeCommand({ commandText: "STAT. MODE\r" });

      // Then — both dispatch successfully
      expect(configure.reason).toBe("return");
      expect(status.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      expect(harness.getNvramImage()[NVR_VDUSettings]! & NVR_MODE_MASK).toBe(1);
      expect(harness.mos.getOutputText()).toMatch(/MODE\s+1/);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("rejects bare prefix without dot (*CONFIG MODE)", () => {
      // When — prefix without '.' is not a valid abbreviation
      const result = harness.invokeCommand({ commandText: "CONFIG MODE 1\r" });

      // Then — ROM does not claim the command (passes to other ROMs)
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(4);
      expect(harness.getNvramImage()[NVR_VDUSettings]! & NVR_MODE_MASK).toBe(defaultMode);
    });

    it("bare *STATUS lists all factory-default config terms", () => {
      const result = harness.invokeCommand({ commandText: "STATUS\r" });

      // Then — CON_Status blankStatus lists each term and value from NVRAM
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      const text = harness.mos.getOutputText();
      expect(text).not.toMatch(/BAUD/);
      expect(text).not.toMatch(/\bTV\b/);
      expect(text).not.toMatch(/\bPRINT\b/);
      expect(text).not.toMatch(/\bDATA\b/);
      expect(text).toMatch(new RegExp(`MODE\\s+${defaultMode}`));
      expect(text).toMatch(/NOBOOT/);
      expect(text).toMatch(/REPEAT\s+8/);
      expect(text).not.toMatch(/CONFIGURE/);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    describe("*CONFIGURE numeric literals (decimal and hex)", () => {
      it("accepts decimal for MODE and DELAY", () => {
        // When — decimal literals on help7 / help255 terms
        expect(harness.invokeCommand({ commandText: "CONFIGURE MODE 2\r" }).reason).toBe("return");
        expect(harness.invokeCommand({ commandText: "CONFIGURE DELAY 40\r" }).reason).toBe("return");

        // Then — NVRAM holds parsed values
        const nvram = harness.getNvramImage();
        expect(nvramMode(nvram)).toBe(2);
        expect(nvram[NVR_KeyRptDelay]).toBe(40);
        expect(harness.mos.unexpected).toHaveLength(0);

        harness.mos.resetCaptures();

        // When / Then — *STATUS echoes decimal forms
        for (const [term, pattern] of [
          ["MODE", /MODE\s+2/],
          ["DELAY", /DELAY\s+40/],
        ] as const) {
          harness.mos.resetCaptures();
          const status = harness.invokeCommand({ commandText: `STATUS ${term}\r` });
          expect(status.reason).toBe("return");
          expect(harness.mos.getOutputText()).toMatch(pattern);
        }
      });

      it("accepts hexadecimal for LANG and FILE (ROM-slot terms)", () => {
        // When — single hex digit per STR_ParseHex (helpRom terms)
        expect(harness.invokeCommand({ commandText: "CONFIGURE LANG C\r" }).reason).toBe("return");
        expect(harness.invokeCommand({ commandText: "CONFIGURE FILE 3\r" }).reason).toBe("return");

        // Then — high / low nibbles of NVR_DefaultRoms updated (C = slot 12, 3 = slot 3)
        const nvram = harness.getNvramImage();
        expect(nvramLang(nvram)).toBe(0x0c);
        expect(nvramFile(nvram)).toBe(3);
        expect(harness.mos.unexpected).toHaveLength(0);

        harness.mos.resetCaptures();

        // When / Then — *STATUS prints helpRom terms as a single hex digit
        const langStatus = harness.invokeCommand({ commandText: "STATUS LANG\r" });
        expect(langStatus.reason).toBe("return");
        expect(harness.mos.getOutputText()).toMatch(/LANG\s+C/);

        harness.mos.resetCaptures();
        const fileStatus = harness.invokeCommand({ commandText: "STATUS FILE\r" });
        expect(fileStatus.reason).toBe("return");
        expect(harness.mos.getOutputText()).toMatch(/FILE\s+3/);
      });

      it("rejects out-of-range decimal MODE", () => {
        // Given — factory default mode
        expect(nvramMode(harness.getNvramImage())).toBe(defaultMode);

        // When — MODE 8 exceeds help7 range (0–7)
        const result = harness.invokeCommand({ commandText: "CONFIGURE MODE 8\r" });

        // Then — NVRAM unchanged (bad parameter path)
        expect(nvramMode(harness.getNvramImage())).toBe(defaultMode);
      });
    });
  });
});
