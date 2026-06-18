import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_ZERO_PAGE_EXEMPT,
  I2CBeebRomTestHarness,
  I2C_BUF_ADDRESS,
  I2C_SLOT_ADDRESS,
  I2C_ZPREG_ADDRESS,
  MOS_ROM_SLOT,
  requireConfiglessRomVariants,
} from "../../../../bin/rom-unittest/src/index.js";

const romVariants = requireConfiglessRomVariants();

const I2CSTAT_ADDRESS = 0x02e7;

/** BBC BASIC resident integer variable store: A%=$0404, B%=$0408 … Z%=$0468.
 *  The ROM (`intvar`) reads/writes the variable's byte at $0400 + 4*(letter-$40). */
const ivarAddr = (name: string): number =>
  0x0400 + 4 * (name.toUpperCase().charCodeAt(0) - 0x40);

/**
 * Bus star commands, mocked at the bus subroutine layer (`i2cstart`, `i2cstop`,
 * `i2caddr`, `i2crxack`, `i2ctxbyte`, `i2crxbyte`, `i2ctxack`, `i2creset`) — NOT at
 * the I²C protocol / VIA bit-bang level. `*I2CTEST` is intentionally excluded.
 */
describe("I2C bus star commands", () => {
  describe.each(romVariants)("$label ($id)", (variant) => {
    const isPcf = variant.label.includes("PCF8583");

    let harness: I2CBeebRomTestHarness;

    beforeEach(() => {
      // Given — real ROM + labels; bus subroutines (incl. i2cstart/i2cstop)
      // stubbed; bufloc ($CE/$CF) exempted as documented RXB/RXD workspace
      harness = new I2CBeebRomTestHarness({
        romPath: variant.path,
        labelsPath: variant.labelsPath,
        workspaceGuardOptions: {
          zeroPageExempt: [
            ...DEFAULT_ZERO_PAGE_EXEMPT,
            { start: 0xce, length: 2 },
          ],
        },
      });
      harness.mockI2cBus();
    });

    it("*I2C records the ROM slot and sets the present marker", () => {
      // Given — MOS reports this ROM is running in slot 3
      harness.writeMemory(MOS_ROM_SLOT, 0x03);

      // When — MOS service 4 dispatches *I2C
      const result = harness.invokeCommand({ commandText: "I2C\r" });

      // Then — ROM stores present marker ($2C) and its own slot, handled (A=0)
      expect(result.reason).toBe("return");
      expect(harness.readMemory(I2C_ZPREG_ADDRESS)).toBe(0x2c);
      expect(harness.readMemory(I2C_SLOT_ADDRESS)).toBe(0x03);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CRESET returns after the stubbed bus reset", () => {
      // Given — default bus mock (i2creset stubbed)

      // When — MOS service 4 dispatches *I2CRESET
      const result = harness.invokeCommand({ commandText: "I2CRESET\r" });

      // Then — command returns cleanly, handled (A=0)
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CSTOP returns to MOS", () => {
      // Given — default bus mock (i2cstop stubbed)

      // When — MOS service 4 dispatches *I2CSTOP
      const result = harness.invokeCommand({ commandText: "I2CSTOP\r" });

      // Then — command returns cleanly, handled (A=0)
      expect(result.reason).toBe("return");
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CQUERY reports no devices when the bus mock NACKs all probes", () => {
      // Given — default bus mock with no devices added (every probe NACKs)

      // When — MOS service 4 dispatches *I2CQUERY
      const result = harness.invokeCommand({ commandText: "I2CQUERY\r" });

      // Then — ROM prints "No devices" and terminates i2cbuf with $FF
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/No devices/i);
      expect(harness.readMemory(I2C_BUF_ADDRESS)).toBe(0xff);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CQUERY Q lists responding devices in i2cbuf without screen output", () => {
      // Given — bus mock with a single device ACKing at address $48
      harness.addI2cDevice(0x48);

      // When — MOS service 4 dispatches *I2CQUERY Q (quiet)
      const result = harness.invokeCommand({ commandText: "I2CQUERY Q\r" });

      // Then — no screen output; i2cbuf holds $48 then the $FF terminator
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toBe("");
      expect(harness.readMemory(I2C_BUF_ADDRESS)).toBe(0x48);
      expect(harness.readMemory(I2C_BUF_ADDRESS + 1)).toBe(0xff);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CTXB without parameters prints the ROM version", () => {
      // Given — default bus mock; no parameters supplied

      // When — MOS service 4 dispatches a bare *I2CTXB
      const result = harness.invokeCommand({ commandText: "I2CTXB\r" });

      // Then — ROM prints its version banner instead of transmitting
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/3\.3/);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    if (isPcf) {
      it("*I2CTXB transmits a data byte to a responding device", () => {
        // Given — bus mock with a device ACKing at $68
        harness.addI2cDevice(0x68);

        // When — MOS service 4 dispatches *I2CTXB 68 A5
        const result = harness.invokeCommand({ commandText: "I2CTXB 68 A5\r" });

        // Then — addr $68 written, data $A5 transmitted, status clear (no error)
        expect(result.reason).toBe("return");
        expect(harness.readMemory(I2CSTAT_ADDRESS)).toBe(0);
        expect(harness.getI2cAddrLog()).toContain(0x68);
        expect(harness.getI2cTxBytes()).toContain(0xa5);
        expect(harness.registers().a).toBe(0);
        expect(harness.mos.unexpected).toHaveLength(0);
      });

      it("*I2CTXB FF sends eight data bits without a device address", () => {
        // Given — default bus mock; $FF selects the "no address" special case

        // When — MOS service 4 dispatches *I2CTXB FF A5
        const result = harness.invokeCommand({ commandText: "I2CTXB FF A5\r" });

        // Then — data $A5 is transmitted with no preceding address byte
        expect(result.reason).toBe("return");
        expect(harness.getI2cTxBytes()).toContain(0xa5);
        expect(harness.registers().a).toBe(0);
        expect(harness.mos.unexpected).toHaveLength(0);
      });

      it("*I2CTXD transmits buffered bytes to a responding device", () => {
        // Given — device ACKing at $68 and one buffered byte ($DE) in i2cbuf
        harness.addI2cDevice(0x68);
        harness.writeMemory(I2C_BUF_ADDRESS, 0xde);

        // When — MOS service 4 dispatches *I2CTXD 68 01 (send 1 buffered byte)
        const result = harness.invokeCommand({ commandText: "I2CTXD 68 01\r" });

        // Then — addr $68 written, buffered $DE transmitted, status clear
        expect(result.reason).toBe("return");
        expect(harness.readMemory(I2CSTAT_ADDRESS)).toBe(0);
        expect(harness.getI2cAddrLog()).toContain(0x68);
        expect(harness.getI2cTxBytes()).toContain(0xde);
        expect(harness.registers().a).toBe(0);
        expect(harness.mos.unexpected).toHaveLength(0);
      });

      it("*I2CTXB takes address and data from BASIC integer vars (A%/B%)", () => {
        // Given — A% holds the device address ($68), B% holds the data byte ($A5)
        harness.addI2cDevice(0x68);
        harness.writeMemory(ivarAddr("A"), 0x68);
        harness.writeMemory(ivarAddr("B"), 0xa5);

        // When — MOS service 4 dispatches *I2CTXB A% B%
        const result = harness.invokeCommand({ commandText: "I2CTXB A% B%\r" });

        // Then — clbyte resolves both vars: addr $68 written, data $A5 transmitted
        expect(result.reason).toBe("return");
        expect(harness.readMemory(I2CSTAT_ADDRESS)).toBe(0);
        expect(harness.getI2cAddrLog()).toContain(0x68);
        expect(harness.getI2cTxBytes()).toContain(0xa5);
        expect(harness.registers().a).toBe(0);
        expect(harness.mos.unexpected).toHaveLength(0);
      });
    } else {
      // DS3231: suspected ROM defect — txbval/txdval (bare RTS) leave carry set,
      // so the command aborts at the parser before any bus I/O (i2cstat stays 1).
      it("*I2CTXB is a no-op on DS3231 builds (suspected ROM defect)", () => {
        // Given — device ACKing at $68 (would receive data on a healthy build)
        harness.addI2cDevice(0x68);

        // When — MOS service 4 dispatches *I2CTXB 68 A5
        const result = harness.invokeCommand({ commandText: "I2CTXB 68 A5\r" });

        // Then — no bytes transmitted and status b0 stuck set (defect signature)
        expect(result.reason).toBe("return");
        expect(harness.getI2cTxBytes()).toHaveLength(0);
        expect(harness.readMemory(I2CSTAT_ADDRESS)).toBe(1);
        expect(harness.registers().a).toBe(0);
        expect(harness.mos.unexpected).toHaveLength(0);
      });

      it("*I2CTXD is a no-op on DS3231 builds (suspected ROM defect)", () => {
        // Given — device ACKing at $68 and one buffered byte ($DE) in i2cbuf
        harness.addI2cDevice(0x68);
        harness.writeMemory(I2C_BUF_ADDRESS, 0xde);

        // When — MOS service 4 dispatches *I2CTXD 68 01
        const result = harness.invokeCommand({ commandText: "I2CTXD 68 01\r" });

        // Then — no bytes transmitted and status b0 stuck set (defect signature)
        expect(result.reason).toBe("return");
        expect(harness.getI2cTxBytes()).toHaveLength(0);
        expect(harness.readMemory(I2CSTAT_ADDRESS)).toBe(1);
        expect(harness.registers().a).toBe(0);
        expect(harness.mos.unexpected).toHaveLength(0);
      });
    }

    it("*I2CRXB stores one byte from the bus mock in i2cbuf", () => {
      // Given — bus mock with a device at $68 primed to return one byte ($42)
      harness.mockI2cBus({ devices: [0x68], rxBytes: [0x42] });

      // When — MOS service 4 dispatches *I2CRXB 68 (read one byte)
      const result = harness.invokeCommand({ commandText: "I2CRXB 68\r" });

      // Then — the received byte $42 is stored at the start of i2cbuf
      expect(result.reason).toBe("return");
      expect(harness.readMemory(I2C_BUF_ADDRESS)).toBe(0x42);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CRXD receives multiple bytes into i2cbuf", () => {
      // Given — bus mock with a device at $68 primed to return two bytes
      harness.mockI2cBus({ devices: [0x68], rxBytes: [0xaa, 0xbb] });

      // When — MOS service 4 dispatches *I2CRXD 68 02 (read two bytes)
      const result = harness.invokeCommand({ commandText: "I2CRXD 68 02\r" });

      // Then — both received bytes land consecutively in i2cbuf
      expect(result.reason).toBe("return");
      expect(harness.readMemory(I2C_BUF_ADDRESS)).toBe(0xaa);
      expect(harness.readMemory(I2C_BUF_ADDRESS + 1)).toBe(0xbb);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("*I2CRXB stores the received byte into a BASIC integer var (A%)", () => {
      // Given — device $68 primed to return $42; A% pre-seeded with a stale value
      harness.mockI2cBus({ devices: [0x68], rxBytes: [0x42] });
      harness.writeMemory(ivarAddr("A") + 0, 0xff);
      harness.writeMemory(ivarAddr("A") + 1, 0xff);
      harness.writeMemory(ivarAddr("A") + 2, 0xff);
      harness.writeMemory(ivarAddr("A") + 3, 0xff);

      // When — MOS service 4 dispatches *I2CRXB 68 A%
      const result = harness.invokeCommand({ commandText: "I2CRXB 68 A%\r" });

      // Then — read byte lands in A%'s LS byte; the upper 3 bytes are zeroed
      expect(result.reason).toBe("return");
      expect(harness.readMemory(ivarAddr("A") + 0)).toBe(0x42);
      expect(harness.readMemory(ivarAddr("A") + 1)).toBe(0x00);
      expect(harness.readMemory(ivarAddr("A") + 2)).toBe(0x00);
      expect(harness.readMemory(ivarAddr("A") + 3)).toBe(0x00);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });

    it("rejects a non-A-Z %-variable identifier with a syntax error", () => {
      // Given — '@%' is a real BASIC var ($0400) but intvar only accepts A-Z

      // When — MOS service 4 dispatches *I2CTXB @% 05
      const result = harness.invokeCommand({ commandText: "I2CTXB @% 05\r" });

      // Then — parser rejects it ("Bad syntax!") before any bus I/O occurs
      expect(result.reason).toBe("return");
      expect(harness.mos.getOutputText()).toMatch(/Bad syntax/i);
      expect(harness.getI2cAddrLog()).toHaveLength(0);
      expect(harness.getI2cTxBytes()).toHaveLength(0);
      expect(harness.registers().a).toBe(0);
      expect(harness.mos.unexpected).toHaveLength(0);
    });
  });
});
