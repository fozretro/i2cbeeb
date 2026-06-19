import type { MosMock } from "../mos/mos-mock.js";
import { run6502 } from "../cpu/jsbeeb-cpu.js";
import type { JsbeebCpu } from "../cpu/types.js";

/** Shadow Serv7 locations 5/15 — models persistent store separate from session &0D6D. */
export interface ClassicServ7Store {
  lang: number;
  tubeEnabled: boolean;
}

export function createDefaultClassicServ7Store(): ClassicServ7Store {
  return { lang: 0x0c, tubeEnabled: true };
}

/**
 * OSBYTE 161/162 stubs for classic AP6 amalgam tests.
 * Reads/writes shadow store (like I²C FRAM would) while *LANG/*TUBE only touch &0D6D.
 */
export function installClassicServ7OsbyteStubs(
  mos: MosMock,
  store: ClassicServ7Store,
): void {
  mos.stubOsbyteDefault(({ a, x, y }) => {
    const code = a & 0xff;
    const addr = x & 0xff;

    if (code === 161) {
      if (addr === 5) {
        // FILE nibble (b0-3) is unbacked by the fallback Serv7 -> reports &F
        // ("no default FS") so Serv3 skips, matching ROM Manager's ORA #&0F.
        return { y: ((store.lang & 0x0f) << 4) | 0x0f, carry: false };
      }
      if (addr === 15) {
        return { y: store.tubeEnabled ? 0 : 1, carry: false };
      }
      return { y: y & 0xff, carry: false };
    }

    if (code === 162) {
      if (addr === 5) {
        store.lang = (y & 0xff) >> 4;
        return { y: y & 0xff, carry: false };
      }
      if (addr === 15) {
        store.tubeEnabled = (y & 0x01) !== 0;
        return { y: y & 0xff, carry: false };
      }
      return { y: y & 0xff, carry: false };
    }

    return { a: 0, carry: false };
  });
}

/** Spare page-2 NOP used as the return landing for nested service-7 dispatch. */
const NESTED_SERV7_TRAMPOLINE = 0x0220;

export interface DelegatingClassicServ7Options {
  cpu: JsbeebCpu;
  /** Composite `$8003` service entry of the amalgam under test. */
  serviceEntry: number;
  /** Sideways slot the amalgam is paged into (seeds X / OS_ROMNum context). */
  romSlot: number;
}

/**
 * OSBYTE 161/162 handler that delegates to ROM Manager's REAL 6502 Serv7.
 *
 * Instead of answering NVRAM reads/writes in JS (see {@link installClassicServ7OsbyteStubs}),
 * this models how MOS turns an unrecognised OSBYTE into a service 7 call: it seeds
 * &EF/&F0/&F1 with A/X/Y and dispatches service 7 into the composite ROM, so the actual
 * `Serv7` code (incl. the FILE-sentinel `ORA #&0F`) executes. This makes Serv3 hard-break
 * tests true end-to-end (Serv3 -> OSBYTE 161 -> real Serv7) rather than stub-backed.
 *
 * The dispatch is re-entrant: it runs from inside the trapped OSBYTE (the MOS-mock
 * `debugInstruction` hook), so it must not disturb the outer caller. It therefore:
 *   - runs on the CURRENT stack pointer (nested frame sits below the outer JSR frame),
 *   - lands on a dedicated trampoline (not the outer 0x0200 return),
 *   - snapshots + restores the full zero page and CPU registers afterwards
 *     (modelling MOS preserving the issuing ROM's context across an OSBYTE).
 * Memory outside zero page (e.g. ROM Manager's &0D6D shadow) is intentionally left
 * changed so writes via OSBYTE &A2 persist.
 */
export function installDelegatingClassicServ7Osbyte(
  mos: MosMock,
  { cpu, serviceEntry, romSlot }: DelegatingClassicServ7Options,
): void {
  cpu.writemem(NESTED_SERV7_TRAMPOLINE, 0xea);

  mos.stubOsbyteDefault(({ a, x, y }) => {
    const code = a & 0xff;
    if (code !== 161 && code !== 162) {
      // Not an NVRAM call — behave as an unclaimed/handled OSBYTE no-op.
      return { a: 0, carry: false };
    }

    const zp = new Uint8Array(256);
    for (let addr = 0; addr < 256; addr++) zp[addr] = cpu.readmem(addr);
    const saved = {
      a: cpu.a,
      x: cpu.x,
      y: cpu.y,
      s: cpu.s,
      pc: cpu.pc,
      c: cpu.p.c,
      z: cpu.p.z,
      i: cpu.p.i,
      d: cpu.p.d,
      v: cpu.p.v,
      n: cpu.p.n,
      halted: cpu.halted,
    };

    // MOS dispatches an unrecognised OSBYTE as service 7 with A/X/Y in &EF/&F0/&F1.
    cpu.writemem(0xef, code);
    cpu.writemem(0xf0, x & 0xff);
    cpu.writemem(0xf1, y & 0xff);

    run6502(cpu, {
      pc: serviceEntry,
      a: 7,
      x: romSlot & 0xff,
      y: 0,
      s: saved.s, // continue below the outer stack frame — don't clobber its return
      returnAddress: NESTED_SERV7_TRAMPOLINE,
      flags: { i: true },
    });

    const resultY = cpu.y & 0xff;
    const claimed = (cpu.a & 0xff) === 0;

    // Restore the outer CPU + zero page so the trapped OSBYTE RTS resumes the caller.
    for (let addr = 0; addr < 256; addr++) cpu.writemem(addr, zp[addr]!);
    cpu.a = saved.a;
    cpu.x = saved.x;
    cpu.y = saved.y;
    cpu.s = saved.s;
    cpu.pc = saved.pc;
    cpu.p.c = saved.c;
    cpu.p.z = saved.z;
    cpu.p.i = saved.i;
    cpu.p.d = saved.d;
    cpu.p.v = saved.v;
    cpu.p.n = saved.n;
    cpu.halted = saved.halted;

    if (code === 161) {
      return { y: resultY, carry: !claimed };
    }
    return { carry: !claimed };
  });
}

export function writeNVRAMStore(store: ClassicServ7Store, lang: number): void {
  store.lang = lang & 0x0f;
}

export function writeClassicServ7TubeEnabled(store: ClassicServ7Store, enabled: boolean): void {
  store.tubeEnabled = enabled;
}

export function readNVRAMStore(store: ClassicServ7Store): number {
  return store.lang & 0x0f;
}
