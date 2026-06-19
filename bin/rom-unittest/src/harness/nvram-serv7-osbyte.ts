import { NVR_DefaultRoms, NVR_FILE_MASK, NVR_LANG_MASK, NVR_PRINT_MASK, NVR_TubeSerialPrint, nvramTubeEnabled } from "../nvram/configure-defaults.js";
import type { NvramImage } from "../nvram/defaults.js";
import type { MosMock } from "../mos/mos-mock.js";

/**
 * OSBYTE 161/162 stubs backed by a PCF8583 NVRAM image (ap6 amalgam with embedded I²C).
 * Matches {@link classic-serv7-osbyte} encoding so ROM Manager Serv10 reads the
 * same values FRAM holds after *CONFIGURE.
 */
export function installNvramServ7OsbyteStubs(mos: MosMock, getImage: () => NvramImage): void {
  mos.stubOsbyteDefault(({ a, x, y }) => {
    const image = getImage();
    const code = a & 0xff;
    const addr = x & 0xff;

    if (code === 161) {
      if (addr === NVR_DefaultRoms) {
        // LANG (b4-b7) + FILE (b0-b3) — service 3 reads FILE, Serv10 reads LANG.
        return { y: image[NVR_DefaultRoms]! & (NVR_LANG_MASK | NVR_FILE_MASK), carry: false };
      }
      if (addr === NVR_TubeSerialPrint) {
        // PRINT (b5-b7) for service-3 *FX 5 + TUBE bit (b0) for GetTubeAndLang.
        return { y: (image[NVR_TubeSerialPrint]! & NVR_PRINT_MASK) | (nvramTubeEnabled(image) ? 0 : 1), carry: false };
      }
      if (addr < image.length) {
        return { y: image[addr]! & 0xff, carry: false };
      }
      return { y: y & 0xff, carry: false };
    }

    if (code === 162) {
      if (addr === NVR_DefaultRoms) {
        image[NVR_DefaultRoms] = (image[NVR_DefaultRoms]! & ~NVR_LANG_MASK) | (y & NVR_LANG_MASK);
        return { y: y & 0xff, carry: false };
      }
      if (addr === NVR_TubeSerialPrint) {
        image[NVR_TubeSerialPrint] = (image[NVR_TubeSerialPrint]! & ~0x01) | (y & 0x01);
        return { y: y & 0xff, carry: false };
      }
      if (addr < image.length) {
        image[addr] = y & 0xff;
        return { y: y & 0xff, carry: false };
      }
      return { y: y & 0xff, carry: false };
    }

    return { a: 0, carry: false };
  });
}
