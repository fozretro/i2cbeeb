import { describe, expect, it, beforeEach } from "vitest";
import {
  I2CBeebRomTestHarness,
  parseServiceEntry,
  rtcHookAddresses,
  serviceEntryAddress,
  createJsbeebCpu,
  run6502,
  snapshotRegisters,
  requireConfiglessRomVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfiglessRomVariants();

describe("configure-less I2C ROM variants", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      // Given — real ROM binary + BeebAsm labels; MOS vectors mocked; CPU RAM cleared
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
    });

    it("resolves the service entry from BeebAsm labels and the ROM header JMP", () => {
      // Given — harness constructed from variant ROM and labels (beforeEach)
      const expected = serviceEntryAddress(harness.symbols);

      // When — service entry is read from labels and from the ROM header at $8003
      const headerEntry = parseServiceEntry(harness.rom, harness.romBase);

      // Then — labels match harness, and the ROM header JMP target agrees
      // (standalone sideways ROMs publish their service entry at $8003)
      expect(harness.serviceEntry).toBe(expected);
      expect(headerEntry).toBe(expected);
    });

    it("resolves getrtc, writetd, and wtbrk from BeebAsm labels", () => {
      // Given — harness constructed from variant ROM and labels (beforeEach)
      const hooks = rtcHookAddresses(harness.symbols);

      // When — RTC mock hook addresses are taken from the symbol table
      const { getrtc, writetd, wtbrk } = {
        getrtc: harness.getrtcEntry,
        writetd: harness.writetdEntry,
        wtbrk: harness.wtbrkEntry,
      };

      // Then — getrtc/writetd/wtbrk labels match what the harness will patch
      expect(getrtc).toBe(hooks.getrtc);
      expect(writetd).toBe(hooks.writetd);
      expect(wtbrk).toBe(hooks.wtbrk);
    });

    it("handles service call 9 (*HELP) with bare CR and prints the ROM title", () => {
      // Given — harness ready; no RTC stub needed (*HELP uses MOS output only)

      // When — MOS invokes service 9 with an empty command line
      const result = harness.invokeService({ serviceType: 9, commandText: "\r" });

      // Then — ROM prints title/version via OSASCI; MOS reports command handled (A=9)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/I2C/);
      expect(harness.mos.getOutputText()).toMatch(/3\.3/);
      expect(harness.registers().a).toBe(9);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("handles service call 9 (*HELP I2C) and lists commands", () => {
      // Given — harness ready; no RTC stub needed

      // When — MOS invokes service 9 with *HELP I2C
      const result = harness.invokeService({
        serviceType: 9,
        commandText: "I2C\r",
        y: 0,
      });

      // Then — ROM lists I2C commands including I2CQUERY
      expect(result.reason).toBe("return");
      const text = harness.mos.getOutputText();
      expect(text).toMatch(/I2C/);
      expect(text).toMatch(/I2CQUERY/i);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("passes through unhandled service types (A=2) with RTS", () => {
      // Given — harness ready; service type 2 is not handled by this ROM

      // When — MOS invokes an unrecognised service type
      const result = harness.invokeService({ serviceType: 2, commandText: "\r" });

      // Then — ROM passes through unchanged (A=2) with no MOS output
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(2);
      expect(harness.mos.oswrch).toHaveLength(0);
    });

    it("handles *TIME and prints BCD hh:mm:ss", () => {
      // Given — RTC mock returns fixed BCD time in buf00–buf02
      harness.stubGetrtc({ hours: 0x12, minutes: 0x34, seconds: 0x56 });

      // When — MOS service 4 dispatches *TIME
      const result = harness.invokeCommand({ commandText: "TIME\r" });

      // Then — ROM reads getrtc buffer and prints hh:mm:ss via OSASCI (A=0)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("12:34:56");
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("handles *DATE and prints day dd-mm-yy", () => {
      // Given — RTC mock returns fixed BCD date in buf03–buf06
      harness.stubGetrtc({ weekday: 3, date: 0x31, month: 0x05, year: 0x26 });

      // When — MOS service 4 dispatches *DATE
      const result = harness.invokeCommand({ commandText: "DATE\r" });

      // Then — ROM reads getrtc buffer and prints day dd-mm-yy via OSASCI (A=0)
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("Tue 31-05-26");
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*TSET updates mock RTC and *TIME reads it back", () => {
      // Given — stateful RTC mock (getrtc read + writetd write)
      harness.mockRtc();

      // When — *TSET parses and writes time via writetd
      const tset = harness.invokeCommand({ commandText: "TSET 09:30:15\r" });

      // Then — command succeeds, echoes time, mock holds BCD 09:30:15
      expect(tset.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("09:30:15");
      expect(harness.getRtcState()).toMatchObject({
        hours: 0x09,
        minutes: 0x30,
        seconds: 0x15,
      });

      // Given — MOS output cleared; RTC mock state unchanged
      harness.mos.resetCaptures();

      // When — *TIME reads back via getrtc
      const time = harness.invokeCommand({ commandText: "TIME\r" });

      // Then — same time is printed from mock state
      expect(time.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("09:30:15");
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*DSET updates mock RTC and *DATE reads it back", () => {
      // Given — stateful RTC mock (getrtc read + writetd write)
      harness.mockRtc();

      // When — *DSET parses and writes date via writetd
      const dset = harness.invokeCommand({ commandText: "DSET Tue 31-05-26\r" });

      // Then — command succeeds, echoes date, mock holds Tue 31-05-26
      expect(dset.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("Tue 31-05-26");
      expect(harness.getRtcState()).toMatchObject({
        weekday: 3,
        date: 0x31,
        month: 0x05,
        year: 0x26,
      });

      // Given — MOS output cleared; RTC mock state unchanged
      harness.mos.resetCaptures();

      // When — *DATE reads back via getrtc
      const date = harness.invokeCommand({ commandText: "DATE\r" });

      // Then — same date is printed from mock state
      expect(date.reason).toBe("return");
      expect(harness.mos.getOutputText()).toContain("Tue 31-05-26");
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});

describe("6502 harness primitives", () => {
  it("runs a tiny inline snippet until RTS returns", () => {
    // Given — flat 6502 map with LDA #65; RTS at $7002; return trampoline at $0200
    const cpu = createJsbeebCpu();
    cpu.writemem(0x7000, 0xa9); // LDA #65
    cpu.writemem(0x7001, 0x41);
    cpu.writemem(0x7002, 0x60); // RTS

    // When — CPU runs from $7000 until return address is reached
    const result = run6502(cpu, {
      pc: 0x7000,
      returnAddress: 0x0200,
    });

    // Then — RTS returns to harness; A holds loaded value
    expect(result.reason).toBe("return");
    expect(snapshotRegisters(cpu).a).toBe(0x41);
  });
});
