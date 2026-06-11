import type { NvramImage, PartialNvramImage } from "./defaults.js";
import { mergeNvramImage } from "./defaults.js";

/** NVRAM addresses from `src/configure/Settings.asm`. */
export const NVR_VDUSettings = 10;
export const NVR_DefaultRoms = 5;
export const NVR_KeyRptDelay = 12;
export const NVR_TubeSerialPrint = 15;
export const NVR_NVRSize = 255;

/** Screen mode is stored in NVR_VDUSettings bits 0–2. */
export const NVR_MODE_MASK = 0x07;

/** LANG / FILE share NVR_DefaultRoms (high / low nibble per CON_DataTable). */
export const NVR_LANG_MASK = 0xf0;
export const NVR_FILE_MASK = 0x0f;

/** Baud rate index is in NVR_TubeSerialPrint bits 2–4 (displayed as index + 1). */
export const NVR_BAUD_SHIFT = 2;
export const NVR_BAUD_MASK = 0x1c;

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

export function nvramLang(image: NvramImage): number {
  return (image[NVR_DefaultRoms]! & NVR_LANG_MASK) >> 4;
}

export function nvramFile(image: NvramImage): number {
  return image[NVR_DefaultRoms]! & NVR_FILE_MASK;
}

/** MOS-reported baud rate (1–8), from stored index in NVRAM. */
export function nvramBaudRate(image: NvramImage): number {
  return ((image[NVR_TubeSerialPrint]! & NVR_BAUD_MASK) >> NVR_BAUD_SHIFT) + 1;
}

export function nvramTubeEnabled(image: NvramImage): boolean {
  return (image[NVR_TubeSerialPrint]! & 0x01) !== 0;
}
