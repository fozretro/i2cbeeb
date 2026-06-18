/** BBC MOS entry points (6502 vectors in the upper ROM page). */
export const MOS = {
  OSRDCH: 0xffe0,
  OSASCI: 0xffe3,
  OSNEWL: 0xffe7,
  OSWRCH: 0xffee,
  OSWORD: 0xfff1,
  OSBYTE: 0xfff4,
  OSCLI: 0xfff7,
} as const;

/** Additional MOS vectors stubbed for Time-Config *CONFIGURE / *STATUS parsing. */
export const MOS_CONFIGURE = {
  GSINIT: 0xffc2,
  GSREAD: 0xffc5,
} as const;

/** Common MOS zero-page locations used by sideways ROMs. */
export const ZP = {
  CLI: 0xf2,
  OSW_A: 0xef,
  OSW_X: 0xf0,
  OSW_Y: 0xf1,
} as const;

/** I2CBeeb low-RAM workspace (see i2cwrk in I2CBeeb.asm). */
export const I2CWRK_ADDRESS = 0x02e0;
export const I2C_BYTE_ADDRESS = I2CWRK_ADDRESS + 10;
export const I2C_BUF_ADDRESS = 0x0a00;
export const I2C_SLOT_ADDRESS = I2CWRK_ADDRESS + 5;
export const I2C_ZPREG_ADDRESS = I2CWRK_ADDRESS + 6;
export const MOS_ROM_SLOT = 0xf4;

export const ROM_BASE = 0x8000;
export const ROM_SIZE = 0x4000;

export type MosVector = (typeof MOS)[keyof typeof MOS];
