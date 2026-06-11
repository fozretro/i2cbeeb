import { describe, expect, it, beforeEach } from "vitest";
import { I2CBeebRomTestHarness, requireConfiglessRomVariants } from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfiglessRomVariants();

describe("Time-on-Break (*TBRK) and boot service (A=1)", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      // Given — real ROM + labels; MOS mocked; RTC/NVRAM mocks at valid defaults
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      harness.mockRtc();
      harness.mockConfigure();
    });

    it("*TBRK turns Time-on-Break on when currently off", () => {
      // Given — default RTC mock state (tbrk=0 per DEFAULT_RTC_MOCK_STATE)
      expect(harness.getRtcState().tbrk).toBe(0);

      // When — MOS service 4 dispatches *TBRK
      const result = harness.invokeCommand({ commandText: "TBRK\r" });

      // Then — ROM reports On, stores tbrk=1 via wtbrk, command handled (A=0)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/\bOn\b/);
      expect(harness.getRtcState().tbrk).toBe(1);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*TBRK turns Time-on-Break off when currently on", () => {
      // Given — RTC mock with ToB already enabled
      harness.stubGetrtc({ tbrk: 1 });

      // When — MOS service 4 dispatches *TBRK
      const result = harness.invokeCommand({ commandText: "TBRK\r" });

      // Then — ROM reports Off, stores tbrk=0 via wtbrk, command handled (A=0)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/\bOff\b/);
      expect(harness.getRtcState().tbrk).toBe(0);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*TBRK toggles off then on across successive calls", () => {
      // Given — default RTC mock state (tbrk=0)
      expect(harness.getRtcState().tbrk).toBe(0);

      // When — first *TBRK enables ToB
      const first = harness.invokeCommand({ commandText: "TBRK\r" });

      // Then — On and tbrk=1
      expect(first.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/\bOn\b/);
      expect(harness.getRtcState().tbrk).toBe(1);

      // Given — MOS output cleared; tbrk still on
      harness.mos.resetCaptures();

      // When — second *TBRK disables ToB
      const second = harness.invokeCommand({ commandText: "TBRK\r" });

      // Then — Off and tbrk=0
      expect(second.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/\bOff\b/);
      expect(harness.getRtcState().tbrk).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("service 1 (boot) prints nothing when Time-on-Break is off", () => {
      // Given — default RTC mock (tbrk=0); valid time/date loaded but ToB disabled
      expect(harness.getRtcState().tbrk).toBe(0);

      // When — MOS invokes sideways ROM boot service (A=1)
      const result = harness.invokeBoot();

      // Then — no date/time header; ROM preserves boot call for other ROMs (A=1)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toBe("");
      expect(harness.registers().a).toBe(1);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("service 1 (boot) prints time when Time-on-Break is on", () => {
      // Given — RTC mock with ToB enabled and known BCD time
      harness.stubGetrtc({ tbrk: 1 });

      // When — MOS invokes sideways ROM boot service (A=1)
      const result = harness.invokeBoot();

      // Then — xxnow prints hh:mm:ss from getrtc buffer; boot returns A=1
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("09:30:15");
      expect(harness.registers().a).toBe(1);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("service 1 (boot) prints date when Time-on-Break is on", () => {
      // Given — RTC mock with ToB enabled and known BCD date
      harness.stubGetrtc({ tbrk: 1 });

      // When — MOS invokes sideways ROM boot service (A=1)
      const result = harness.invokeBoot();

      // Then — xxnow prints day dd-mm-yy after time; boot returns A=1
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("Tue 31-05-26");
      expect(harness.registers().a).toBe(1);
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});
