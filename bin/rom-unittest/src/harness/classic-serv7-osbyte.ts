import type { MosMock } from "../mos/mos-mock.js";

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
        return { y: (store.lang & 0x0f) << 4, carry: false };
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

export function writeNVRAMStore(store: ClassicServ7Store, lang: number): void {
  store.lang = lang & 0x0f;
}

export function writeClassicServ7TubeEnabled(store: ClassicServ7Store, enabled: boolean): void {
  store.tubeEnabled = enabled;
}

export function readNVRAMStore(store: ClassicServ7Store): number {
  return store.lang & 0x0f;
}
