/**
 * ROM Manager service 3 on ap6-classic (`bin/buildap6/out/ap6-classic.rom`) — no I²C / no EEPROM.
 *
 * With no I²C slice, ROM Manager's own Serv7 (&0D6D shadow) is the OSBYTE
 * 161/162 provider. It backs LANG (byte 5 b4-7), the unplug maps (6/7) and Tube
 * (byte 15 b0), but has no storage for the FILE nibble (byte 5 b0-3) or the
 * *FX5/PRINT field (byte 15 b5-7).
 *
 * For FILE the fallback therefore reports the &F "no default FS" sentinel
 * (Serv7 `ORA #&0F`), so Serv3 must NOT redirect OS_ROMNum — there is no
 * configured filing system without persistent NVRAM. PRINT reads as 0, so the
 * printer destination is left at *FX 5,0 (the MOS default on break).
 *
 * These Serv3 tests opt into `delegateNvramToRealServ7()`, so OSBYTE 161/162 is
 * answered by ROM Manager's REAL 6502 Serv7 via a nested service-7 dispatch
 * (no JS NVRAM stub). They are therefore true end-to-end: Serv3 -> OSBYTE ->
 * real Serv7. The `real Serv7 dispatch` block below additionally locks the raw
 * byte format the provider returns.
 *
 * Run via `npm run test:classic-only` / `test:classic-composite`.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  Ap6ClassicAmalgamSession,
  RomManagerTestHarness,
  expectByte,
  requireClassicCompositeVariants,
} from "../../../../../bin/rom-unittest/src/index.js";

const OS_ROMNUM = 0xf4;
const variants = requireClassicCompositeVariants();

describe("Service 3 with no I²C NVRAM (ap6-classic fallback Serv7)", () => {
  describe.each(variants)("$label ($id)", (variant) => {
    let session: Ap6ClassicAmalgamSession;
    let romManager: RomManagerTestHarness;

    beforeEach(() => {
      // Given — ap6-classic.rom; ROM Manager Serv7 (&0D6D shadow) is the only
      // NVRAM provider, backing LANG/Tube but not FILE/PRINT.
      session = new Ap6ClassicAmalgamSession({ romPath: variant.path });
      romManager = session.romManager;
      session.reset();
    });

    it("hard break: unbacked FILE reports &F so Serv3 leaves OS_ROMNum alone (no default FS)", () => {
      // Given — &F4 seeded to our slot at dispatch; FILE has no backing store.
      // OSBYTE 161/162 is delegated to ROM Manager's REAL Serv7 (no JS NVRAM stub),
      // so this is end-to-end: Serv3 -> OSBYTE 161 (loc 5) -> real Serv7 (ORA #&0F).
      session.delegateNvramToRealServ7();
      expectByte(romManager, OS_ROMNUM, session.romSlot);
      romManager.mos.resetCaptures();

      // When — service 3 on a hard break with no key held
      const result = romManager.invokeServ3({ breakType: 2, keyHeld: false });

      // Then — FILE reads &F (>= our slot) so the redirect is skipped; &F4 is
      // unchanged and the call returns unclaimed (A=3).
      expect(result.reason).toBe("return");
      expectByte(romManager, OS_ROMNUM, session.romSlot);
      expect(romManager.registers().a).toBe(3);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    it("hard break: PRINT field reads 0 (unbacked) so Serv3 applies *FX 5,0", () => {
      // Delegated to the real Serv7: Serv3 -> OSBYTE 161 (loc 15) -> real Serv7,
      // whose PRINT field (b5-7) is unbacked and reads 0.
      session.delegateNvramToRealServ7();
      romManager.mos.resetCaptures();

      // When — service 3 on a hard break
      const result = romManager.invokeServ3({ breakType: 2, keyHeld: false });

      // Then — printer destination decoded from byte 15 b5-7 = 0
      expect(result.reason).toBe("return");
      const printerCalls = romManager.mos.getOsbyteCalls(5);
      expect(printerCalls).toHaveLength(1);
      expect(printerCalls[0]!.x).toBe(0);
      expect(romManager.mos.unexpected).toHaveLength(0);
    });

    // The Serv3 cases above now delegate OSBYTE 161/162 to the real Serv7. These
    // two assert the raw provider contract directly: seed &EF/&F0/&F1 with the
    // unrecognised OSBYTE &A1 params and invoke service 7, so the actual 6502
    // read path (incl. the FILE-sentinel ORA #&0F) executes and its return value
    // is asserted at the byte level.
    describe("real Serv7 dispatch (OSBYTE &A1 via service 7)", () => {
      function invokeServ7Read(location: number) {
        romManager.writeMemory(0xef, 0xa1); // OSBYTE &A1 — read NVRAM
        romManager.writeMemory(0xf0, location); // X = NVRAM location
        romManager.writeMemory(0xf1, 0); // Y
        return romManager.invokeService({ serviceType: 7, y: 0, commandText: "\r" });
      }

      it("location 5: returns LANG in b4-7 and the FILE=&F sentinel in b0-3", () => {
        // Given — session LANG C at &0D6D (the only thing the fallback backs)
        romManager.setSessionLang(0x0c);
        romManager.mos.resetCaptures();

        // When — MOS offers the unrecognised OSBYTE &A1 (loc 5) as service 7
        const result = invokeServ7Read(5);

        // Then — ROM Manager claims it (A=0) and Y = &CF: LANG=C, FILE=&F
        expect(result.reason).toBe("return");
        expect(romManager.registers().a).toBe(0);
        const y = romManager.registers().y & 0xff;
        expect(y >> 4).toBe(0x0c); // LANG (b4-7)
        expect(y & 0x0f).toBe(0x0f); // FILE sentinel (ORA #&0F) — "no default FS"
        expect(romManager.mos.unexpected).toHaveLength(0);
      });

      it("location 15: returns the Tube bit with PRINT bits (b5-7) clear", () => {
        // Given — tube enabled in &0D6D
        romManager.setSessionTubeDisabled(false);
        romManager.mos.resetCaptures();

        // When — service 7 for OSBYTE &A1 (loc 15)
        const result = invokeServ7Read(15);

        // Then — claimed; Y has Tube in b0 and PRINT field (b5-7) = 0, which is
        // why Serv3 decodes *FX 5,0 on the classic build.
        expect(result.reason).toBe("return");
        expect(romManager.registers().a).toBe(0);
        const y = romManager.registers().y & 0xff;
        expect(y & 0x01).toBe(1); // Tube enabled
        expect((y >> 5) & 0x07).toBe(0); // PRINT bits unbacked -> 0
        expect(romManager.mos.unexpected).toHaveLength(0);
      });
    });
  });
});
