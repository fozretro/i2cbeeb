import { NVR_DefaultRoms, NVR_LANG_MASK, NVR_TubeSerialPrint, nvramTubeEnabled } from "../nvram/configure-defaults.js";
import type { NvramImage } from "../nvram/defaults.js";
import type { MosMock } from "../mos/mos-mock.js";

/**
 * OSBYTE 161/162 stubs backed by a PCF8583 NVRAM image (ap6 amalgam with embedded I²C).
 * Matches {@link classic-serv7-osbyte} encoding so ROM Manager Serv10 reads the
 * same values FRAM holds after *CONFIGURE.
 */
export function installNvramServ7OsbyteStubs(mos: MosMock, image: NvramImage): void {
  mos.stubOsbyteDefault(({ a, x, y }) => {
    const code = a & 0xff;
    const addr = x & 0xff;

    if (code === 161) {
      if (addr === NVR_DefaultRoms) {
        return { y: image[NVR_DefaultRoms]! & NVR_LANG_MASK, carry: false };
      }
      if (addr === NVR_TubeSerialPrint) {
        return { y: nvramTubeEnabled(image) ? 0 : 1, carry: false };
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
      return { y: y & 0xff, carry: false };
    }

    return { a: 0, carry: false };
  });
}
