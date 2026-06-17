import { describe, expect, it, beforeEach } from "vitest";
import { I2CBeebRomTestHarness, requireConfigureFolderVariants } from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfigureFolderVariants();

describe("*HELP I2C — CONFIGURE and STATUS parameter hints (#34)", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
    });

    it("*HELP I2C lists optional (<config>) for CONFIGURE and STATUS", () => {
      // Given — INC_CONFIG ROM with CONFIGURE/STATUS commands

      // When — MOS service 9 with *HELP I2C
      const result = harness.invokeService({
        serviceType: 9,
        commandText: "I2C\r",
        y: 0,
      });

      // Then — help text matches upstream Time-Config wording
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      const text = harness.mos.getOutputText();
      expect(text).toMatch(/CONFIGURE \(<config>\)/);
      expect(text).toMatch(/STATUS \(<config>\)/);
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});
