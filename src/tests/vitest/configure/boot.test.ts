import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_CONFIGURE_NVRAM,
  NVR_InitMarker,
  NVR_VDUSettings,
  I2CBeebRomTestHarness,
  nvramMode,
  requireConfigureFolderVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const configureVariants = requireConfigureFolderVariants();

/** NVRAM addresses from `src/configure/Settings.asm`. */
const NVR_BELL_BS_FORMAT = 16;
const NVR_BOOT_BIT = 0x10;
const NVR_KEY_RPT_DELAY = 12;
const NVR_KEY_RPT_RATE = 13;
const NVR_PRINTER_IGNORE = 14;
const NVR_TUBE_SERIAL_PRINT = 15;

describe("service 1 boot with blank / factory-reset NVRAM", () => {
  describe.each(configureVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
    });

    it("boot with blank NVRAM runs SET_Reset and *STATUS shows factory defaults", () => {
      // Given — blank RTC/NVRAM (NVR 17 = 0); SET_Startup takes resetEverything
      harness.mockBlankRtc();
      harness.mockConfigureBlank();
      expect(harness.getNvramImage()[NVR_InitMarker]).toBe(0);

      // When — MOS service 1 (boot) runs SET_Startup then returns
      const boot = harness.invokeBoot();

      // Then — boot completes; NVRAM initialised marker written
      expect(boot.reason).toBe("return");
      expect(harness.registers().a).toBe(1);
      expect(harness.getNvramImage()[NVR_InitMarker]).toBe(0xff);
      expect(harness.mos.unexpected).toHaveLength(0);

      const nvram = harness.getNvramImage();
      expect(nvram[NVR_KEY_RPT_DELAY]).toBe(DEFAULT_CONFIGURE_NVRAM[NVR_KEY_RPT_DELAY]);
      expect(nvram[NVR_KEY_RPT_RATE]).toBe(DEFAULT_CONFIGURE_NVRAM[NVR_KEY_RPT_RATE]);
      expect(nvram[NVR_PRINTER_IGNORE]).toBe(DEFAULT_CONFIGURE_NVRAM[NVR_PRINTER_IGNORE]);
      expect(nvram[NVR_TUBE_SERIAL_PRINT]).toBe(DEFAULT_CONFIGURE_NVRAM[NVR_TUBE_SERIAL_PRINT]);
      expect(nvramMode(nvram)).toBe(6);
      expect(nvram[NVR_BELL_BS_FORMAT]! & NVR_BOOT_BIT).toBe(0);

      // When / Then — *STATUS reads SET_DefaultsTable values (non-zero where applicable)
      for (const { term, pattern } of [
        { term: "MODE", pattern: /MODE\s+6/ },
        { term: "NOBOOT", pattern: /NOBOOT/ },
        { term: "DELAY", pattern: /DELAY\s+50/ },
        { term: "REPEAT", pattern: /REPEAT\s+8/ },
        { term: "IGNORE", pattern: /IGNORE\s+10/ },
        { term: "BAUD", pattern: /BAUD\s+7/ },
      ]) {
        harness.mos.resetCaptures();
        const result = harness.invokeCommand({ commandText: `STATUS ${term}\r` });
        expect(result.reason).toBe("return");
        expect(harness.mos.getOutputText()).toMatch(pattern);
        expect(harness.mos.unexpected).toHaveLength(0);
      }
    });
    it("boot with R held runs SET_Reset and *STATUS shows factory MODE", () => {
      // Given — initialised NVRAM with non-default MODE; R key stubbed during SET_Startup
      harness.mockRtc();
      harness.mockConfigure({ [NVR_InitMarker]: 0xff, [NVR_VDUSettings]: 0x02 });
      expect(nvramMode(harness.getNvramImage())).toBe(2);
      harness.mockRKeyPressed();

      // When — MOS service 1 (boot) sees R via OSBYTE &79 and calls SET_Reset
      const boot = harness.invokeBoot();

      // Then — boot completes; MODE reset to factory default in NVRAM
      expect(boot.reason).toBe("return");
      expect(harness.registers().a).toBe(1);
      expect(nvramMode(harness.getNvramImage())).toBe(6);
      expect(harness.getNvramImage()[NVR_BELL_BS_FORMAT]! & NVR_BOOT_BIT).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);

      // Given — MOS output cleared
      harness.mos.resetCaptures();

      // When — *STATUS MODE reads back factory value
      const status = harness.invokeCommand({ commandText: "STATUS MODE\r" });

      // Then — printed status shows MODE 6 and factory NOBOOT
      expect(status.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/MODE\s+6/);
      harness.mos.resetCaptures();
      const bootStatus = harness.invokeCommand({ commandText: "STATUS NOBOOT\r" });
      expect(bootStatus.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/NOBOOT/);
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});
