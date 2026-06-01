import { describe, expect, it, beforeEach } from "vitest";
import { RomTestHarness, requireRomVariants } from "../../../bin/rom-unittest/src/index.js";

const romVariants = requireRomVariants();

/** Split MOS-captured *HELP output into logical lines (CR/LF tolerant). */
function helpLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

describe("*HELP output (#22 — extra scaffolding line)", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: RomTestHarness;

    beforeEach(() => {
      harness = new RomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
    });

    it("bare *HELP passes through to other ROMs (A=9) and prints the ROM title", () => {
      // Given — MOS service 9 with empty command line (*HELP<CR>)
      const result = harness.invokeService({ serviceType: 9, commandText: "\r" });

      // Then — handled but passed on (other sideways ROMs may also contribute)
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(9);
      expect(harness.mos.getOutputText()).toMatch(/I2C/);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("bare *HELP does not emit a leading blank line before the title", () => {
      // When — global *HELP: MOS calls each ROM; I2C must not add a spacer line
      // before its banner (ABUG 2026 / #22 — "Additional line output from I2C when *HELP").
      harness.invokeService({ serviceType: 9, commandText: "\r" });

      const text = harness.mos.getOutputText();
      const lines = helpLines(text);

      // Then — first line is the title, not an empty scaffold line
      expect(text).toMatch(/^I2C/);
      expect(lines[0]).not.toBe("");
      expect(lines[0]).toMatch(/^I2C/);
    });

    it("*HELP I2C lists commands after the title (extended help)", () => {
      // When — filtered help for this ROM only (A=0 when complete)
      const result = harness.invokeService({
        serviceType: 9,
        commandText: "I2C\r",
        y: 0,
      });

      // Then — command table present; extended path may use Acorn blank-line leader
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.getOutputText()).toMatch(/I2CQUERY/i);
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});
