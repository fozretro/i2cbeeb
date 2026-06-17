import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_CONFIGURE_NVRAM,
  I2CBeebRomTestHarness,
  NVR_DefaultRoms,
  NVR_VDUSettings,
  nvramLang,
  nvramMode,
  requireConfigureFolderVariants,
  requireConfiglessRomVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfigureFolderVariants();

describe("OSBYTE 161/162 via service 7 (#33 — NVList intent)", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
      });
      expect(harness.hasConfigureNvram()).toBe(true);
      harness.mockConfigure();
    });

    /**
     * Replicates `src/tests/native/NVList.bas` PROCreadall (lines 30–32): bulk read via
     * `A%=161` / `USR&FFF4` for each address 255→0. Spot-checks configure addresses
     * used later in PROCnvshow rather than all 256 iterations.
     */
    it("OSBYTE 161 reads NVRAM bytes at configure addresses (NVList PROCreadall path)", () => {
      // Given — NVList.bas line 34: PROCnvshow calls PROCreadall before decode
      const image = harness.getNvramImage();

      // When / Then — NVList.bas lines 30–31: `FOR X%=255 TO 0 STEP -1` read loop
      for (const addr of [0, 5, 10, 12, 15, 17] as const) {
        const result = harness.invokeUnknownOsbyte({ code: 161, x: addr });
        expect(result.run.reason).toBe("return");
        expect(result.claimed).toBe(true);
        expect(harness.registers().a).toBe(0);
        expect(result.y).toBe(image[addr]! & 0xff);
      }
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    /**
     * Replicates `src/tests/native/NVList.bas` PROCnvshow decode fields after PROCreadall
     * (lines 34–50): filing system / language nibble at address 5 (lines 39–40) and
     * screen MODE at address 10 (lines 49–50).
     */
    it("decoded MODE and LANG nibbles match configure defaults (NVList PROCnvshow fields)", () => {
      // Given — NVList.bas lines 34–35: settings view after PROCreadall
      const image = harness.getNvramImage();

      // When — NVList.bas lines 39–40 (LANG/FILE at nv%?5), 49–50 (MODE at nv%?10)
      const modeRead = harness.invokeUnknownOsbyte({ code: 161, x: NVR_VDUSettings });
      const langRead = harness.invokeUnknownOsbyte({ code: 161, x: NVR_DefaultRoms });

      // Then — same bytes NVList prints in PROCnvshow
      expect(modeRead.y).toBe(nvramMode(image));
      expect(langRead.y).toBe(image[NVR_DefaultRoms]! & 0xff);
      expect(nvramMode(image)).toBe(DEFAULT_CONFIGURE_NVRAM[NVR_VDUSettings]! & 0x07);
      expect(nvramLang(image)).toBe(0x0f);
    });

    /**
     * Replicates NVRAM write/read exercised by `src/I2CBeeb.bas` hardware tests 05–06
     * (lines 44–68): OSBYTE &A2 write then &A1 read via `CALL &FFF4`. NVList is
     * read-only but shares the same OSBYTE 161/162 API surface.
     */
    it("OSBYTE 162 write then 161 read round-trips a byte (I2CBeeb.bas tests 05–06)", () => {
      // Given — I2CBeeb.bas lines 47–48 / 60–63 (address 200, safe above configure range)
      const testAddr = 200;
      const testVal = 0xaa;

      // When — I2CBeeb.bas line 50: `A%=&A2:X%=…:Y%=…:CALL &FFF4`
      const write = harness.invokeUnknownOsbyte({ code: 162, x: testAddr, y: testVal });
      expect(write.claimed).toBe(true);
      expect(harness.registers().a).toBe(0);

      // When — I2CBeeb.bas lines 65–66: `A%=&A1:X%=…:CALL &FFF4`
      const read = harness.invokeUnknownOsbyte({ code: 161, x: testAddr });

      // Then — I2CBeeb.bas line 68: `IF Y%=TESTVAL%`
      expect(read.claimed).toBe(true);
      expect(read.y).toBe(testVal);
      expect(harness.getNvramImage()[testAddr]).toBe(testVal);
    });

    /**
     * Replicates `src/tests/native/NVList.bas` PROCreadall size query (lines 31–32):
     * `X%=255:Y%=49:A%=USR&FFF4` → `nvmax%`. ROM returns byte at 255 today; full
     * Acorn size metadata deferred to #36.
     */
    it("OSBYTE 161 size query (X=255 Y=49) behaviour is documented — see gap issue", () => {
      // Given — NVList.bas lines 31–32 (after bulk read loop line 30)
      const result = harness.invokeUnknownOsbyte({ code: 161, x: 255, y: 49 });

      // Then — per-byte xosbyte only; nvmax%+1 at NVList.bas line 35 not yet correct
      expect(result.claimed).toBe(true);
      expect(result.y).toBe(harness.getNvramImage()[255]! & 0xff);
    });
  });
});

describe("OSBYTE 161 on config-less ROMs", () => {
  /**
   * NVList.bas requires INC_CONFIG NVRAM (shipped on AP6 configure builds only).
   * Config-less sideways ROMs have no service-7 handler — no matching .bas probe.
   */
  it("service 7 is not claimed when INC_CONFIG is absent", () => {
    // Given — i2cb.rom (INC_CONFIG=0); NVList not applicable
    const variant = requireConfiglessRomVariants().find((v) => v.id === "i2cb");
    expect(variant).toBeDefined();
    const harness = new I2CBeebRomTestHarness({
      romPath: variant!.path,
      labelsPath: variant!.labelsPath,
    });
    expect(harness.hasConfigureNvram()).toBe(false);

    // When — OSBYTE 161 would reach no NVRAM handler
    const result = harness.invokeUnknownOsbyte({ code: 161, x: 10 });

    // Then — service 7 unclaimed (A=7)
    expect(result.claimed).toBe(false);
    expect(harness.registers().a).toBe(7);
  });
});
