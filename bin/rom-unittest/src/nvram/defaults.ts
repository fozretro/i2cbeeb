/** 256-byte NVRAM image (PCF8583 free RAM / configure store). */
export type NvramImage = Uint8Array;

/**
 * Valid default NVRAM for configure-less EAP6 builds.
 * Zero-filled — SET_Startup treats unset slots as defaults.
 */
export function createDefaultNvramImage(): NvramImage {
  return new Uint8Array(256);
}

/** Blank NVRAM (all zero) — `SET_Startup` treats byte 255 = 0 as uninitialised. */
export function createBlankNvramImage(): NvramImage {
  return new Uint8Array(256);
}

export type PartialNvramImage = Partial<Record<number, number>>;

export function mergeNvramImage(overrides?: PartialNvramImage, base?: NvramImage): NvramImage {
  const image = new Uint8Array(base ?? createDefaultNvramImage());
  if (overrides) {
    for (const [address, value] of Object.entries(overrides)) {
      if (value === undefined) continue;
      image[Number(address) & 0xff] = value & 0xff;
    }
  }
  return image;
}
