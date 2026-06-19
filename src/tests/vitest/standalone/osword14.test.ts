import { describe, expect, it, beforeEach } from "vitest";
import {
  I2CBeebRomTestHarness,
  nullTerminatedAscii,
  oswordNoResponse,
  requireConfiglessRomVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfiglessRomVariants();

/** OSWORD 14 subcalls implemented by I²C ROM today (see `xosword` in I2CBeeb.asm). */
const IMPLEMENTED_OSWORD14_SUBCALLS = [0, 1, 4] as const;

/**
 * Subcalls exercised by RTCRead.bas that the ROM leaves untouched (No response).
 * Type 2 (convert 7-byte BCD → string) is implemented separately below — it takes a
 * caller-supplied BCD block rather than reading the RTC, so it is asserted on its own.
 */
const UNIMPLEMENTED_OSWORD14_SUBCALLS = [3, 5, 6, 7, 10, 11, 12, 13, 14, 15] as const;

/**
 * Maps each OSWORD 14 subcall to its call site in `src/tests/native/RTCRead.bas`
 * (main loop lines 9–24 and the matching DEF PROC body).
 */
const RTC_READ_BAS_REF: Record<number, string> = {
  0: "RTCRead.bas:9 → PROCosw14_0 (lines 27–30); Read RTC as string",
  1: "RTCRead.bas:10 → PROCosw14_1 (lines 32–35); Read 7-byte BCD",
  2: "RTCRead.bas:11 → PROCosw14_2 (lines 37–41); Convert BCD to string",
  3: "RTCRead.bas:12 → PROCosw14_3 (lines 43–47); Read 5-byte time",
  4: "RTCRead.bas:13 → PROCosw14_4 (lines 49–53); Read 7-byte BCD from server",
  5: "RTCRead.bas:14 → PROCosw14_X (lines 55–58)",
  6: "RTCRead.bas:15 → PROCosw14_X (lines 55–58)",
  7: "RTCRead.bas:16 → PROCosw14_X (lines 55–58)",
  8: "RTCRead.bas:17 → PROCosw14_0 (lines 27–30); Read clock string",
  9: "RTCRead.bas:18 → PROCosw14_1 (lines 32–35); Read 8-byte BCD",
  10: "RTCRead.bas:19 → PROCosw14_2 (lines 37–41); Convert 8-byte BCD",
  11: "RTCRead.bas:20 → PROCosw14_3 (lines 43–47); Read BCD timezone",
  12: "RTCRead.bas:21 → PROCosw14_X (lines 55–58)",
  13: "RTCRead.bas:22 → PROCosw14_X (lines 55–58)",
  14: "RTCRead.bas:23 → PROCosw14_X (lines 55–58)",
  15: "RTCRead.bas:24 → PROCosw14_X (lines 55–58)",
};

describe("OSWORD 14 / 15 via service 8 (#33 — RTCRead / RTCTest intent)", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      harness.mockRtc({
        hours: 0x09,
        minutes: 0x30,
        seconds: 0x15,
        weekday: 3,
        date: 0x31,
        month: 0x05,
        year: 0x26,
      });
    });

    /**
     * Replicates `src/tests/native/RTCRead.bas` OSWORD 14 read probes for subcalls
     * the ROM claims today (types 0, 1, 4). Each case mirrors PROCcall (line 60:
     * `A%=14:CALL OSWORD`) and the `IF !X%=sub%:PRINT"No response"` guard (lines 29,
     * 34, etc.) — here we assert the block is updated (response received).
     *
     * @see RTC_READ_BAS_REF for per-subcall line mapping.
     */
    it.each(IMPLEMENTED_OSWORD14_SUBCALLS)(
      "OSWORD 14 subcall %i is claimed and returns RTC data",
      (subcall) => {
        // Given — RTCRead.bas PROCcall (line 60); probe: RTC_READ_BAS_REF[subcall]
        const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall });

        // Then — ROM claims service 8 (A=0) and mutates the block (!X% <> sub%)
        expect(result.run.reason).toBe("return");
        expect(result.claimed).toBe(true);
        expect(harness.registers().a).toBe(0);
        expect(oswordNoResponse(result.block, subcall)).toBe(false);
        expect(harness.mos.unexpected).toHaveLength(0);

        if (subcall === 1) {
          // RTCRead.bas:10 → PROCbcd (lines 83–100) — 7-byte BCD at X%+0
          expect(result.block[0]).toBe(0x26);
          expect(result.block[1]).toBe(0x05);
          expect(result.block[2]).toBe(0x31);
          expect(result.block[3]).toBe(0x03);
          expect(result.block[4]).toBe(0x09);
          expect(result.block[5]).toBe(0x30);
          expect(result.block[6]).toBe(0x15);
        }

        if (subcall === 0) {
          // RTCRead.bas:9 → PROCstring / PROCstring1 (lines 62–80) — Compact string
          const text = nullTerminatedAscii(result.block);
          expect(text).toMatch(/^Tue,/);
          expect(text).toContain("2026");
          expect(text).toContain("09:30:15");
        }

        if (subcall === 4) {
          // RTCRead.bas:13 — I²C type 4 (*NOW$ string via OSW0E4, not server BCD)
          const text = nullTerminatedAscii(result.block);
          expect(text).toContain("09:30:15");
          expect(text).toMatch(/Tue|Wed|Thu|Fri|Sat|Sun|Mon/);
        }
      },
    );

    /**
     * Replicates `src/tests/native/RTCTest.bas` OSWORD 14 type 2 convert (DATA line 37
     * "Convert 7-byte BCD"; vector line 19 test 1) and `RTCRead.bas` PROCosw14_2 (lines
     * 37–41 → PROCstring). Byte 0 = subcall; bytes 1–7 = Acorn BCD one-byte shifted in
     * order [year, month, date, weekday, hour, minute, second]; the result string is
     * written back over the block (Compact `Day,DD MMM YYYY.HH:MM:SS`, century inferred
     * at the &80 pivot — year &80 ⇒ 1980).
     */
    it("OSWORD 14 subcall 2 converts a 7-byte Acorn BCD block to the Compact string (RTCTest.bas:19,37; RTCRead.bas:37–41)", () => {
      // Given — RTCTest.bas line 19 vector (test 1): 1980-01-01, weekday 7 (Sat), 11:22:33
      const bcd = [0x80, 0x01, 0x01, 0x07, 0x11, 0x22, 0x33];

      // When — RTCRead.bas:11 → PROCosw14_2(2): `?X%=2 … A%=14:CALL OSWORD`
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 2, seed: bcd });

      // Then — ROM claims (A=0) and writes the Compact date/time string over the block
      expect(result.run.reason).toBe("return");
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
      expect(nullTerminatedAscii(result.block)).toBe("Sat,01 Jan 1980.11:22:33");
    });

    /**
     * Replicates `src/tests/native/RTCRead.bas` PROCosw14_1(9) (line 18 → PROCbcd, lines
     * 83–100) and RTCTest.bas DATA line 40 "Read 8-byte BCD": OSWORD 14 type 9 reads the
     * clock as 8-byte Acorn BCD. Layout is type 1 shifted one byte for a leading BCD
     * century at offset 0 (`PROCbcd1` line 97: 8-byte path reads century from `X%?0`),
     * then [year, month, date, weekday, hour, minute, second] at offsets 1–7. Century is
     * derived at the &80 pivot — mock year &26 ⇒ 20xx ⇒ &20.
     */
    it("OSWORD 14 subcall 9 reads 8-byte BCD with a leading century byte (RTCRead.bas:18,83–100; RTCTest.bas:40)", () => {
      // Given — beforeEach mockRtc: 2026-05-31, weekday 3, 09:30:15 (BCD)

      // When — RTCRead.bas:18 → PROCosw14_1(9): `?X%=9 … A%=14:CALL OSWORD`
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 9 });

      // Then — ROM claims (A=0) and writes century@0 then 7-byte BCD at offsets 1–7
      expect(result.run.reason).toBe("return");
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(result.block[0]).toBe(0x20); // century (20xx)
      expect(result.block[1]).toBe(0x26); // year
      expect(result.block[2]).toBe(0x05); // month
      expect(result.block[3]).toBe(0x31); // date
      expect(result.block[4]).toBe(0x03); // weekday
      expect(result.block[5]).toBe(0x09); // hours
      expect(result.block[6]).toBe(0x30); // minutes
      expect(result.block[7]).toBe(0x15); // seconds
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    /**
     * Replicates `src/tests/native/RTCRead.bas` subcalls where `IF !X%=sub%` prints
     * "No response" (e.g. lines 29, 34, 40, 45, 51, 57). Full string/BCD validation
     * from PROCstring/PROCbcd is deferred until ROM implements each subcall (#36).
     *
     * @see RTC_READ_BAS_REF for per-subcall line mapping.
     */
    it.each(UNIMPLEMENTED_OSWORD14_SUBCALLS)(
      "OSWORD 14 subcall %i is not claimed (RTCRead No response contract)",
      (subcall) => {
        // When — RTCRead.bas probe: RTC_READ_BAS_REF[subcall]
        const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall });

        // Then — !X% still equals sub% (No response); MOS passes call (A=8)
        expect(result.run.reason).toBe("return");
        expect(result.claimed).toBe(false);
        expect(harness.registers().a).toBe(8);
        expect(oswordNoResponse(result.block, subcall)).toBe(true);
        expect(harness.mos.unexpected).toHaveLength(0);
      },
    );

    /**
     * Replicates `src/tests/native/RTCTest.bas` OSWORD 15 write loop (lines 43–95),
     * specifically subcall 3 "Write 3-byte BCD time" (DATA line 98; vectors lines 54–57)
     * and the IGNORED contract (lines 91–92: `IF U%=&FF OR … PRINT"IGNORED"`).
     * ROM does not claim word 15 today — full vector matrix blocked by #36.
     */
    it("OSWORD 15 write subcalls are not claimed (RTCTest IGNORED contract)", () => {
      // Given — RTCTest.bas lines 51–57 (subcall 3, test 1 BCD vector)
      const before = harness.getRtcState();

      // When — RTCTest.bas line 91: `A%=15` via USR OSWORD
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 3,
        seed: [0x22, 0x33, 0x44],
      });

      // Then — RTCTest.bas lines 91–92: write IGNORED; FNtime (lines 104–105) unchanged
      expect(result.run.reason).toBe("return");
      expect(result.claimed).toBe(false);
      expect(harness.registers().a).toBe(8);
      expect(harness.getRtcState()).toEqual(before);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    /**
     * Replicates `src/tests/native/RTCTest.bas` write-then-read round-trip intent:
     * OSWORD 14 read loop (lines 8–35, subcall 1 DATA line 37 "Read 7-byte BCD") after
     * a time change. Uses *TSET (service 4) instead of OSWORD 15 write (#36) to seed RTC.
     */
    it("*TSET then OSWORD 14 type 1 reads back the written BCD time", () => {
      // Given — RTCTest.bas PROCretime snapshot via FNtime (lines 104–105)
      harness.mockRtc();

      // When — seed time (RTCTest write path stand-in until OSWORD 15 implemented)
      const tset = harness.invokeCommand({ commandText: "TSET 14:25:36\r" });
      expect(tset.reason).toBe("return");
      expect(harness.registers().a).toBe(0);

      // When — RTCTest.bas lines 31–33: `A%=14:CALL OSWORD` for subcall 1
      const read = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 1 });

      // Then — RTCTest.bas line 33 / RTCRead.bas PROCbcd (lines 83–100)
      expect(read.claimed).toBe(true);
      expect(read.block[4]).toBe(0x14);
      expect(read.block[5]).toBe(0x25);
      expect(read.block[6]).toBe(0x36);
    });

    /**
     * Replicates `src/tests/native/RTCTest.bas` opening snapshot (line 6) and FNtime
     * (lines 104–105): tries OSWORD 14 type 8, falls back to type 0 for clock string.
     */
    it("RTCTest FNtime: type 8 unclaimed, type 0 returns clock string (RTCTest.bas lines 6, 104–105)", () => {
      // When — RTCTest.bas line 6: `?X%=0:A%=14:CALL OSWORD` (type 0 snapshot → T$)
      const type0 = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 0 });
      expect(type0.claimed).toBe(true);
      const snapshot = nullTerminatedAscii(type0.block);
      expect(snapshot).toMatch(/^Tue,/);
      expect(snapshot).toContain("09:30:15");

      // When — RTCTest.bas line 104: `?X%=8:A%=14:CALL OSWORD` first branch
      const type8 = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 8 });
      expect(type8.claimed).toBe(false);

      // When — RTCTest.bas lines 104–105: fallback `?X%=0:CALL OSWORD`
      const fallback = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 0 });
      expect(fallback.claimed).toBe(true);
      expect(nullTerminatedAscii(fallback.block)).toBe(snapshot);
    });

    /**
     * Replicates `src/tests/native/RTCRead.bas` PROCstring / PROCstring1 intent for
     * OSWORD 14 type 0 Compact string (lines 62–80). Layout is `Day, DD MMM YYYY.HH:MM:SS`
     * from OSW0E0 — not the Master spacing PROCstring1 assumes for type 2/4 outputs.
     */
    it("RTCRead string fields are well-formed for OSWORD 14 type 0 Compact (RTCRead.bas lines 62–80)", () => {
      // When — RTCRead.bas:9 → PROCosw14_0(0) → PROCstring
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 0 });
      const text = nullTerminatedAscii(result.block);

      // Then — Compact string: `Day,DD MMM YYYY.HH:MM:SS` (no space after comma in OSW0E0)
      expect(text).toMatch(/^[A-Z][a-z]{2},\d{2} [A-Z][a-z]{2} \d{4}\.\d{2}:\d{2}:\d{2}/);
      const day = Number(text.match(/,(\d{2}) /)?.[1]);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
      const month = text.match(/,\d{2} ([A-Z][a-z]{2}) /)?.[1]?.toUpperCase();
      expect(month).toBeDefined();
      expect("JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC").toContain(month!);
      const [hours, minutes, seconds] = text.split(".")[1]!.split(":").map(Number);
      expect(hours).toBeLessThanOrEqual(23);
      expect(minutes).toBeLessThanOrEqual(59);
      expect(seconds).toBeLessThanOrEqual(60);
    });

    /**
     * Replicates `src/tests/native/RTCRead.bas` PROCbcd (lines 83–100): BCD nibbles
     * for OSWORD 14 type 1 must pass FNbcd range checks.
     */
    it("RTCRead PROCbcd bytes pass FNbcd checks for OSWORD 14 type 1 (RTCRead.bas lines 83–100)", () => {
      // When — RTCRead.bas:10 → PROCosw14_1(1) → PROCbcd
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 1 });
      const bcdValid = (byte: number) => (byte & 0x0f) <= 9 && byte <= 0x99;

      // Then — lines 87–92: year/month/date/hour/minute/second BCD validity
      expect(bcdValid(result.block[0]!)).toBe(true);
      expect(bcdValid(result.block[1]!)).toBe(true);
      expect(result.block[1]).toBeGreaterThan(0);
      expect(result.block[1]).toBeLessThanOrEqual(0x12);
      expect(bcdValid(result.block[2]!)).toBe(true);
      expect(result.block[2]).toBeGreaterThan(0);
      expect(result.block[2]).toBeLessThanOrEqual(0x31);
      expect(bcdValid(result.block[4]!)).toBe(true);
      expect(bcdValid(result.block[5]!)).toBe(true);
      expect(bcdValid(result.block[6]!)).toBe(true);
      expect(result.block[3]).toBe(0x03);
    });
  });
});
