import { describe, expect, it, beforeEach } from "vitest";
import {
  NVR_VDUSettings,
  NVR_MODE_MASK,
  RomTestHarness,
  nvramMode,
  requireConfigureRomVariants,
} from "../../../bin/rom-unittest/src/index.js";

const configureVariants = requireConfigureRomVariants();

describe("*CONFIGURE and *STATUS (INC_CONFIG ROMs)", () => {
  describe.each(configureVariants)("$label ($id)", (variant) => {
    let harness: RomTestHarness;

    beforeEach(() => {
      // Given — configure ROM; RTC/NVRAM mocks at SET_DefaultsTable factory defaults
      harness = new RomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      harness.mockRtc();
      harness.mockConfigure();
    });

    it("*STATUS MODE reports default screen mode 0 from NVRAM", () => {
      // Given — NVR_VDUSettings holds SET_DefaultsTable mode bits (0)
      expect(nvramMode(harness.getNvramImage())).toBe(0);

      // When — MOS service 4 dispatches *STATUS MODE
      const result = harness.invokeCommand({ commandText: "STATUS MODE\r" });

      // Then — ROM prints MODE 0 from NVRAM address 10 (A=0)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/MODE\s+0/);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*CONFIGURE MODE 2 stores mode 2 and *STATUS MODE confirms it", () => {
      // Given — default NVRAM has mode 0
      expect(nvramMode(harness.getNvramImage())).toBe(0);

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
      expect(harness.getNvramImage()[NVR_VDUSettings]! & NVR_MODE_MASK).toBe(0);
    });
  });
});
