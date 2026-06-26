import { beforeEach, describe, expect, it } from "vitest";
import { defaultExecHarness, defaultRomHarness } from "./i2ctest-harness.js";

describe("I2CTEST minimal repro", () => {
  describe("ROM (*I2CTEST via service entry)", () => {
    let harness: ReturnType<typeof defaultRomHarness>;

    beforeEach(() => {
      harness = defaultRomHarness();
    });

    it("claims *I2CTEST and runs bus tests 01-10", () => {
      const result = harness.invokeI2CTest();
      const text = harness.outputText();

      expect(result.reason).toBe("return");
      expect(text.match(/Pass/g)?.length).toBe(10);
      expect(text).not.toMatch(/Fail/);
      expect(harness.ap6SafeBitViolation()).toBeNull();
    });
  });

  describe("EXEC (*RUN I2CT)", () => {
    let harness: ReturnType<typeof defaultExecHarness>;

    beforeEach(() => {
      harness = defaultExecHarness();
    });

    it("runs bus tests 01-10 from RAM", () => {
      const result = harness.runExec();
      const text = harness.outputText();

      expect(result.reason).toBe("return");
      expect(text.match(/Pass/g)?.length).toBe(10);
      expect(text).not.toMatch(/Fail/);
      expect(harness.ap6SafeBitViolation()).toBeNull();
    });
  });
});
