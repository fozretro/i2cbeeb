import { describe, expect, it, beforeEach } from "vitest";
import {
  I2CBeebRomTestHarness,
  nullTerminatedAscii,
  oswordNoResponse,
  requireConfiglessRomVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfiglessRomVariants();

/** ASCII byte array for an OSWORD 15 string control block (seeded from XY+1). */
const ascii = (text: string): number[] => Array.from(text, (c) => c.charCodeAt(0) & 0xff);

const MONTHS = "JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC";
const DAYS = "SUNMONTUEWEDTHUFRISAT";

/**
 * Mirrors `src/tests/native/RTCRead.bas` PROCstring1 (lines 63–81): parse the Master
 * read-string layout `"DDD,dd mmm yyyy.hh:mm:ss"` by the exact fixed 1-indexed MID$
 * positions and apply the same validity checks (FNchk digit pairs, month/day INSTR).
 * Returns the decoded fields (1-based day/month indices as PROCstring1 computes them).
 */
function parseMasterString(s: string): {
  dayOfWeek: number;
  date: number;
  month: number;
  year: number;
  century: string;
  hour: number;
  minute: number;
  second: number;
} {
  const at = (start1: number, len: number): string => s.slice(start1 - 1, start1 - 1 + len);
  const isDigits = (pair: string): boolean => /^[0-9][0-9]$/.test(pair); // FNchk inverse

  // Punctuation at the fixed separator positions (PROCstring1 assumes these slots).
  expect(s[3]).toBe(","); // pos 4
  expect(s[6]).toBe(" "); // pos 7
  expect(s[10]).toBe(" "); // pos 11
  expect(s[15]).toBe("."); // pos 16
  expect(s[18]).toBe(":"); // pos 19
  expect(s[21]).toBe(":"); // pos 22

  expect(isDigits(at(5, 2))).toBe(true); // date 01–31
  expect(isDigits(at(14, 2))).toBe(true); // year 00–99
  expect(isDigits(at(12, 2))).toBe(true); // century 00–99
  expect(isDigits(at(17, 2))).toBe(true); // hour 00–23
  expect(isDigits(at(20, 2))).toBe(true); // minute 00–59
  expect(isDigits(at(23, 2))).toBe(true); // second 00–60

  const monthIdx = MONTHS.indexOf(at(8, 3).toUpperCase()); // INSTR-1
  expect(monthIdx).toBeGreaterThanOrEqual(0);
  expect(monthIdx % 3).toBe(0); // aligned to a 3-char month token
  const dayIdx = DAYS.indexOf(at(1, 3).toUpperCase());
  expect(dayIdx).toBeGreaterThanOrEqual(0);
  expect(dayIdx % 3).toBe(0);

  return {
    dayOfWeek: dayIdx / 3 + 1,
    date: Number(at(5, 2)),
    month: monthIdx / 3 + 1,
    year: Number(at(12, 4)),
    century: at(12, 2),
    hour: Number(at(17, 2)),
    minute: Number(at(20, 2)),
    second: Number(at(23, 2)),
  };
}

/**
 * Mirrors `src/tests/native/RTCRead.bas` PROCosw14_2 (line 39) buffer construction
 * *literally* — the fixed probe constants, NOT a hand-picked valid date:
 *   X%!1=&03072620 : X%!5=&30551606 : IF sub%<8 : X%!1=X%!2 : X%!5=X%!6
 * In JGH's offset order this is century=20, year=26, month=07, date=03, day=06 (Fri),
 * hour=16, minute=55, second=30 ⇒ "Fri,03 Jul 2026.16:55:30". Returns the bytes the
 * probe places from control-block offset 1 onward (offset 0 holds the subcall, written
 * by the harness). For sub<8 the 7-byte form shifts the block down one byte (dropping
 * the leading century), exactly as the `.bas` does.
 */
function procOsw14_2Block(sub: number): number[] {
  const b = new Array<number>(16).fill(0);
  const pokeLE = (off: number, val: number): void => {
    b[off] = val & 0xff;
    b[off + 1] = (val >>> 8) & 0xff;
    b[off + 2] = (val >>> 16) & 0xff;
    b[off + 3] = (val >>> 24) & 0xff;
  };
  const readLE = (off: number): number =>
    (b[off]! | (b[off + 1]! << 8) | (b[off + 2]! << 16) | (b[off + 3]! << 24)) >>> 0;
  pokeLE(1, 0x03072620);
  pokeLE(5, 0x30551606);
  if (sub < 8) {
    pokeLE(1, readLE(2));
    pokeLE(5, readLE(6));
  }
  return b.slice(1, 1 + (sub < 8 ? 7 : 8));
}

/** OSWORD 14 subcalls implemented by I²C ROM today (see `xosword` in I2CBeeb.asm). */
const IMPLEMENTED_OSWORD14_SUBCALLS = [0, 1, 4, 8] as const;

/**
 * Subcalls exercised by RTCRead.bas that the ROM leaves untouched (No response).
 * Types 2 and 10 (convert 7-/8-byte BCD → string) are implemented separately below —
 * they take a caller-supplied BCD block rather than reading the RTC, so they are
 * asserted on their own.
 */
const UNIMPLEMENTED_OSWORD14_SUBCALLS = [3, 5, 6, 7, 11, 12, 13, 14, 15] as const;

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

        if (subcall === 0 || subcall === 8) {
          // RTCRead.bas:9/17 → PROCstring / PROCstring1 (lines 62–80) — Compact string.
          // Type 8 is the 8-byte family of type 0 and renders the identical string.
          const text = nullTerminatedAscii(result.block);
          expect(text).toMatch(/^Tue,/);
          expect(text).toContain("2026");
          expect(text).toContain("09:30:15");
        }

        if (subcall === 4) {
          // RTCRead.bas:13 → PROCosw14_4 (lines 49–53) → "Appears to be string" branch
          // (line 53) → PROCstring1 (lines 62–80). Subcall 4 is a documented clashing
          // subcode (I2C Control ROM vs ANFS); the ROM now aligns with Acorn's standard
          // OSWORD &0E and returns the Master Compact string (identical to type 0/8), so
          // PROCstring1 decodes it cleanly on hardware. Faithful mirror of the .bas.
          expect(parseMasterString(nullTerminatedAscii(result.block))).toEqual({
            dayOfWeek: 3, // Tue
            date: 31,
            month: 5, // May
            year: 2026,
            century: "20",
            hour: 9,
            minute: 30,
            second: 15,
          });
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
    it("OSWORD 14 subcall 2 — PROCosw14_2(2) literal block conforms to PROCstring1 (RTCRead.bas:11,37–41,62–80)", () => {
      // Given — RTCRead.bas:39 literal probe buffer (NOT a hand-picked valid date)
      const block = procOsw14_2Block(2);

      // When — RTCRead.bas:40 `?X%=2 … A%=14:CALL OSWORD`
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 2, seed: block });
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);

      // Then — PROCstring falls through to PROCstring1 (lines 62–80): the probe's own
      // positional/range checks pass and decode the corrected probe vector (century
      // inferred at the &80 pivot: year &26 ⇒ 20xx).
      expect(parseMasterString(nullTerminatedAscii(result.block))).toEqual({
        dayOfWeek: 6, // Fri
        date: 3,
        month: 7, // Jul
        year: 2026,
        century: "20",
        hour: 16,
        minute: 55,
        second: 30,
      });
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
     * Replicates `src/tests/native/RTCRead.bas` PROCosw14_2(10) (line 19 → PROCstring,
     * lines 37–41) and RTCTest.bas "Convert 8-byte BCD". OSWORD 14 type 10 converts a
     * caller-supplied 8-byte Acorn BCD block to the Compact string. Byte 0 = subcall;
     * bytes 1–8 = [century, year, month, date, weekday, hour, minute, second]. Unlike
     * type 2 (century inferred at the &80 pivot), type 10 honours the explicit century
     * byte — here &19 with year &26 yields 1926, not the inferred 2026.
     */
    it("OSWORD 14 subcall 10 — PROCosw14_2(10) literal block conforms to PROCstring1 (RTCRead.bas:19,37–41,62–80)", () => {
      // Given — RTCRead.bas:39 literal probe buffer (8-byte form, no sub<8 shift → explicit century)
      const block = procOsw14_2Block(10);

      // When — RTCRead.bas:19 → PROCosw14_2(10): `?X%=10 … A%=14:CALL OSWORD`
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 10, seed: block });
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);

      // Then — PROCstring1 checks (lines 62–80) pass; 8-byte form honours the explicit
      // century byte (&20) verbatim ⇒ 2026.
      expect(parseMasterString(nullTerminatedAscii(result.block))).toEqual({
        dayOfWeek: 6, // Fri
        date: 3,
        month: 7, // Jul
        year: 2026,
        century: "20",
        hour: 16,
        minute: 55,
        second: 30,
      });
    });

    /**
     * Replicates `src/tests/native/RTCTest.bas` "Convert 8-byte BCD" test 4 (line 26:
     * `X%!1=&31129920:X%!5=&33221100`), whose block carries weekday=&00 — JGH's spec
     * permits &00 as "unsupported". This is the regression guard for the Compact
     * formatter: an unsupported weekday must render a fixed-width 3-space day so the
     * rest of the string stays aligned (otherwise the day-name index underflows and
     * corrupts the whole string). Verified on hardware: "   ,31 Dec 2099.11:22:33".
     */
    it("OSWORD 14 subcall 10 renders an unsupported weekday (&00) as a blank, keeping alignment (RTCTest.bas:26)", () => {
      // Given — 8-byte block [century, year, month, date, weekday, hour, min, sec]
      const block = [0x20, 0x99, 0x12, 0x31, 0x00, 0x11, 0x22, 0x33];

      // When — convert 8-byte BCD to string
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 10, seed: block });
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);

      // Then — day is three spaces; remaining fields stay in their fixed positions
      expect(nullTerminatedAscii(result.block).slice(0, 24)).toBe("   ,31 Dec 2099.11:22:33");
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
     * Replicates `src/tests/native/RTCTest.bas` OSWORD 15 write loop (lines 43–95).
     * The ROM now claims the BCD block writes (3,4,7,8) and the string writes
     * (8,11,15,20,24); see `xosw15` in `src/I2CBeeb.asm`. Each write goes getrtc →
     * overwrite the caller's fields → validate → writetd, so unspecified fields are
     * preserved. The century in 4-/8-byte and 4-digit-year forms is validated but not
     * persisted (no RTC stores it), so reads re-derive it at the &80 pivot.
     *
     * The harness RTC mock captures buf00–buf06 on writetd, so getRtcState() reflects
     * the written values (and never a century). beforeEach seeds 2026-05-31 (BCD),
     * weekday 3 (Tue), 09:30:15.
     */
    it("OSWORD 15 subcall 3 writes a 3-byte BCD time, preserving the date (RTCTest.bas:54–57,98)", () => {
      // When — RTCTest.bas line 53/91: write [hour, minute, second]
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 3,
        seed: [0x14, 0x25, 0x36],
      });

      // Then — ROM claims (A=0); time updated, date untouched
      expect(result.run.reason).toBe("return");
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
      const rtc = harness.getRtcState();
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x14, 0x25, 0x36]);
      expect([rtc.date, rtc.month, rtc.year]).toEqual([0x31, 0x05, 0x26]);
    });

    it("OSWORD 15 subcall 4 writes a 4-byte BCD date, preserving the time (RTCTest.bas:58–61,98)", () => {
      // When — RTCTest.bas line 58: write [century, year, month, date]
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 4,
        seed: [0x20, 0x26, 0x12, 0x25],
      });

      // Then — ROM claims; date updated (century dropped), time untouched
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      const rtc = harness.getRtcState();
      expect([rtc.date, rtc.month, rtc.year]).toEqual([0x25, 0x12, 0x26]);
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x09, 0x30, 0x15]);
    });

    it("OSWORD 15 subcall 7 writes a 7-byte BCD time & date (RTCTest.bas:66–69,98)", () => {
      // When — RTCTest.bas line 66: [year, month, date, day, hour, min, sec]
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 7,
        seed: [0x80, 0x01, 0x01, 0x07, 0x11, 0x22, 0x33],
      });

      // Then — ROM claims; all seven fields written (1980-01-01 Sat 11:22:33)
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      const rtc = harness.getRtcState();
      expect([rtc.year, rtc.month, rtc.date, rtc.weekday]).toEqual([0x80, 0x01, 0x01, 0x07]);
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x11, 0x22, 0x33]);
    });

    it("OSWORD 15 subcall 8 writes an 8-byte BCD time & date with century (RTCTest.bas:70–73,98)", () => {
      // When — RTCTest.bas line 70: [century, year, month, date, day, hour, min, sec]
      // XY+3 = month (&12 < &20) selects the BCD path, not the "hh:mm:ss" string.
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 8,
        seed: [0x20, 0x99, 0x12, 0x31, 0x04, 0x22, 0x33, 0x44],
      });

      // Then — ROM claims; all fields written (century dropped on store)
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      const rtc = harness.getRtcState();
      expect([rtc.year, rtc.month, rtc.date, rtc.weekday]).toEqual([0x99, 0x12, 0x31, 0x04]);
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x22, 0x33, 0x44]);
    });

    it('OSWORD 15 subcall 8 writes the "hh:mm:ss" string (overloaded with 8-byte BCD)', () => {
      // When — RTCTest.bas line 70 num%=6 string form; XY+3 = ':' (&3A) selects string
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 8,
        seed: ascii("12:34:56"),
      });

      // Then — time updated, date preserved
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      const rtc = harness.getRtcState();
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x12, 0x34, 0x56]);
      expect([rtc.date, rtc.month, rtc.year]).toEqual([0x31, 0x05, 0x26]);
    });

    it('OSWORD 15 subcall 11 writes the "dd mmm yyyy" string (RTCTest.bas:74)', () => {
      // When — RTCTest.bas line 74: "07 Jan 1979"
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 11,
        seed: ascii("07 Jan 1979"),
      });

      // Then — date updated (Jan=01, year 79); time preserved
      expect(result.claimed).toBe(true);
      const rtc = harness.getRtcState();
      expect([rtc.date, rtc.month, rtc.year]).toEqual([0x07, 0x01, 0x79]);
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x09, 0x30, 0x15]);
    });

    it('OSWORD 15 subcall 15 writes the "DDD,dd mmm yyyy" string (RTCTest.bas:78)', () => {
      // When — RTCTest.bas line 78: "Mon,27 May 2099"
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 15,
        seed: ascii("Mon,27 May 2099"),
      });

      // Then — weekday (Mon=2), date, month (May=05), year written
      expect(result.claimed).toBe(true);
      const rtc = harness.getRtcState();
      expect([rtc.weekday, rtc.date, rtc.month, rtc.year]).toEqual([2, 0x27, 0x05, 0x99]);
    });

    it('OSWORD 15 subcall 20 writes the "dd mmm yyyy.hh:mm:ss" string (RTCTest.bas:82)', () => {
      // When — RTCTest.bas line 82: "04 Sep 1979.12:23:34"
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 20,
        seed: ascii("04 Sep 1979.12:23:34"),
      });

      // Then — full date & time written (Sep=09, year 79)
      expect(result.claimed).toBe(true);
      const rtc = harness.getRtcState();
      expect([rtc.date, rtc.month, rtc.year]).toEqual([0x04, 0x09, 0x79]);
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x12, 0x23, 0x34]);
    });

    it('OSWORD 15 subcall 24 writes the "DDD,dd mmm yyyy.hh:mm:ss" string (RTCTest.bas:86)', () => {
      // When — RTCTest.bas line 86: "Thu,29 Jan 2099.01:12:23"
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 24,
        seed: ascii("Thu,29 Jan 2099.01:12:23"),
      });

      // Then — every field written (Thu=5, Jan=01, year 99)
      expect(result.claimed).toBe(true);
      const rtc = harness.getRtcState();
      expect([rtc.weekday, rtc.date, rtc.month, rtc.year]).toEqual([5, 0x29, 0x01, 0x99]);
      expect([rtc.hours, rtc.minutes, rtc.seconds]).toEqual([0x01, 0x12, 0x23]);
    });

    /**
     * RTCTest.bas line 73 string vector "01:22:33" is valid, but line 70's "34:34:45"
     * has an out-of-range hour (&34 ≥ &24). The ROM claims the call but leaves the RTC
     * unchanged (validation fails before writetd), which `RTCTest.bas` lines 91–92
     * report as "IGNORED".
     */
    it('OSWORD 15 rejects an out-of-range time, leaving the RTC unchanged (RTCTest IGNORED)', () => {
      // Given
      const before = harness.getRtcState();

      // When — invalid "hh:mm:ss" with hour 34
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 8,
        seed: ascii("34:34:45"),
      });

      // Then — claimed (A=0) but RTC untouched
      expect(result.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.getRtcState()).toEqual(before);
    });

    /**
     * RTCTest.bas exercises subcalls 5 (centisecond) and 9 (timezone) too; both are
     * out-of-scope for an I²C clock ROM, so the ROM does not claim them (A=8) and the
     * RTC is untouched.
     */
    it.each([5, 9])("OSWORD 15 subcall %i is out-of-scope and not claimed", (subcall) => {
      // Given
      const before = harness.getRtcState();

      // When
      const result = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall,
        seed: [0x00, 0x00, 0x00, 0x00, 0x00],
      });

      // Then — unclaimed (A=8), RTC unchanged
      expect(result.run.reason).toBe("return");
      expect(result.claimed).toBe(false);
      expect(harness.registers().a).toBe(8);
      expect(harness.getRtcState()).toEqual(before);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    /**
     * End-to-end round-trip: write via OSWORD 15 then read back via OSWORD 14 type 1
     * (BCD). Replaces the *TSET stand-in now that the write path exists. Year &80 ⇒
     * 1980, inside the &80-pivot range, so the round-trip is exact.
     */
    it("OSWORD 15 write → OSWORD 14 type 1 read round-trips the BCD block", () => {
      // When — write 7-byte t&d: 1980-01-02 Wed 11:22:33
      const write = harness.invokeUnknownOsword({
        wordNumber: 15,
        subcall: 7,
        seed: [0x80, 0x01, 0x02, 0x04, 0x11, 0x22, 0x33],
      });
      expect(write.claimed).toBe(true);

      // Then — read it back as 7-byte BCD [year, month, date, weekday, h, m, s]
      const read = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 1 });
      expect(read.claimed).toBe(true);
      expect(Array.from(read.block.slice(0, 7))).toEqual([
        0x80, 0x01, 0x02, 0x04, 0x11, 0x22, 0x33,
      ]);
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
     * (lines 104–105): tries OSWORD 14 type 8 first, falling back to type 0. The ROM now
     * implements type 8 (8-byte family of the clock string), so FNtime's first branch is
     * claimed and yields the same Compact string the type 0 fallback would — the fallback
     * path is therefore never reached on this ROM.
     */
    it("RTCTest FNtime: type 8 returns the clock string, identical to type 0 (RTCTest.bas lines 6, 104–105)", () => {
      // When — RTCTest.bas line 6: `?X%=0:A%=14:CALL OSWORD` (type 0 snapshot → T$)
      const type0 = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 0 });
      expect(type0.claimed).toBe(true);
      const snapshot = nullTerminatedAscii(type0.block);
      expect(snapshot).toMatch(/^Tue,/);
      expect(snapshot).toContain("09:30:15");

      // When — RTCTest.bas line 104: `?X%=8:A%=14:CALL OSWORD` first branch (now claimed)
      const type8 = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 8 });
      expect(type8.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);

      // Then — type 8 renders the identical clock string to the type 0 fallback
      expect(nullTerminatedAscii(type8.block)).toBe(snapshot);
    });

    /**
     * Replicates `src/tests/native/RTCRead.bas` PROCstring / PROCstring1 intent for
     * OSWORD 14 type 0 (lines 62–80). OSW0E0 emits the Master read-string layout
     * `"DDD,dd mmm yyyy.hh:mm:ss"` exactly — the same fixed positions PROCstring1
     * decodes (PROCstring falls through into PROCstring1, so the probe runs these very
     * checks on hardware). beforeEach seeds Tue 2026-05-31 09:30:15.
     */
    it("OSWORD 14 type 0 conforms to the PROCstring1 Master layout (RTCRead.bas lines 62–80)", () => {
      // When — RTCRead.bas:9 → PROCosw14_0(0) → PROCstring → PROCstring1
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 0 });
      const fields = parseMasterString(nullTerminatedAscii(result.block));

      // Then — fields decode at the Master positions and match the seeded clock
      expect(fields).toEqual({
        dayOfWeek: 3, // Tue (DAYS index 6 → 6/3+1)
        date: 31,
        month: 5, // May
        year: 2026,
        century: "20",
        hour: 9,
        minute: 30,
        second: 15,
      });
    });

    /**
     * Type 8 (read clock string, 8-byte family) reuses OSW0E0, so it conforms to the
     * Master layout identically to type 0.
     */
    it("OSWORD 14 type 8 output conforms to the PROCstring1 Master layout (== type 0)", () => {
      const result = harness.invokeUnknownOsword({ wordNumber: 14, subcall: 8 });
      const fields = parseMasterString(nullTerminatedAscii(result.block));
      expect(fields.dayOfWeek).toBe(3);
      expect(fields.year).toBe(2026);
      expect([fields.hour, fields.minute, fields.second]).toEqual([9, 30, 15]);
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
