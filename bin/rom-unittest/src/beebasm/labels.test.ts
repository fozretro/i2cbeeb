import { describe, expect, it } from "vitest";
import { parseBeebAsmLabels, rtcHookAddresses, serviceEntryAddress } from "./labels.js";

const SAMPLE_LABELS = `[{'service':32804L,'getrtc':36290L,'writetd':36324L,'wtbrk':36357L}]`;

describe("BeebAsm labels parser", () => {
  it("parses symbol addresses from -labels output", () => {
    // Given — a BeebAsm -labels file fragment for a DS3231 C.I2CB build
    const content = SAMPLE_LABELS;

    // When — the parser loads service, getrtc, and writetd symbols
    const symbols = parseBeebAsmLabels(content);

    // Then — addresses match known C.I2CB label values
    expect(serviceEntryAddress(symbols)).toBe(0x8024);
    expect(rtcHookAddresses(symbols)).toEqual({
      getrtc: 0x8dc2,
      writetd: 0x8de4,
      wtbrk: 0x8e05,
    });
  });
});
