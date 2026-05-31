import type { NvramImage, PartialNvramImage } from "./defaults.js";
import { mergeNvramImage } from "./defaults.js";

/** NVRAM addresses from `src/configure/Settings.asm`. */
export const NVR_VDUSettings = 10;
export const NVR_NVRSize = 255;

/** Screen mode is stored in NVR_VDUSettings bits 0–2. */
export const NVR_MODE_MASK = 0x07;

/**
 * Default NVRAM bytes written by `SET_Reset` (`SET_DefaultsTable` in Settings.asm).
 * Address 255 must be non-zero so `SET_Startup` treats NVRAM as initialised.
 */
export const DEFAULT_CONFIGURE_NVRAM: PartialNvramImage = {
  0: 0xfe,
  1: 0x00,
  2: 0xeb,
  3: 0x00,
  4: 0xff,
  5: 0xff,
  6: 0xff,
  7: 0xff,
  8: 0x00,
  9: 0x00,
  10: 0x00,
  11: 0xe0,
  12: 0x32,
  13: 0x08,
  14: 0x0a,
  15: 0x3b,
  16: 0xa2,
  [NVR_NVRSize]: 0xff,
};

/** NVRAM image matching a factory-reset configure store. */
export function createDefaultConfigureNvramImage(): NvramImage {
  return mergeNvramImage(DEFAULT_CONFIGURE_NVRAM);
}

export function nvramMode(image: NvramImage): number {
  return image[NVR_VDUSettings]! & NVR_MODE_MASK;
}
