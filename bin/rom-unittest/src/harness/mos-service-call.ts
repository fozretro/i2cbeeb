import type { RunResult } from "../cpu/types.js";
import { ZP } from "../bbc/mos.js";

/** Harness-owned OSWORD/OSBYTE control block (see {@link DEFAULT_RAM_GUARD_EXEMPT}). */
export const OSWORD_CTRL_BLOCK = 0x0700;
export const OSWORD_CTRL_LENGTH = 32;

/** MOS sideways-ROM service types for unclaimed vector dispatch. */
export const MOS_SERVICE_UNKNOWN_OSWORD = 8;
export const MOS_SERVICE_UNKNOWN_OSBYTE = 7;

export interface OswordInvokeOptions {
  wordNumber: number;
  /** Subcall / type byte written to control block offset 0 before the call. */
  subcall: number;
  /** Optional bytes seeded from control block offset 1 onward. */
  seed?: readonly number[];
  blockAddress?: number;
  blockLength?: number;
}

export interface OswordInvokeResult {
  run: RunResult;
  claimed: boolean;
  block: Uint8Array;
  blockAddress: number;
}

export interface OsbyteInvokeOptions {
  code: number;
  x: number;
  y?: number;
}

export interface OsbyteInvokeResult {
  run: RunResult;
  claimed: boolean;
  y: number;
}

/** First 32-bit little-endian word at the start of an OSWORD control block. */
export function oswordBlockFirstWord(block: Uint8Array): number {
  return (
    (block[0] ?? 0) |
    ((block[1] ?? 0) << 8) |
    ((block[2] ?? 0) << 16) |
    ((block[3] ?? 0) << 24)
  );
}

/** RTCRead / RTCTest contract — block untouched when the ROM does not claim the call. */
export function oswordNoResponse(block: Uint8Array, subcall: number): boolean {
  return oswordBlockFirstWord(block) === (subcall & 0xff);
}

export function seedOswordBlock(
  write: (address: number, value: number) => void,
  options: OswordInvokeOptions,
): { blockAddress: number; blockLength: number } {
  const blockAddress = options.blockAddress ?? OSWORD_CTRL_BLOCK;
  const blockLength = options.blockLength ?? OSWORD_CTRL_LENGTH;
  for (let i = 0; i < blockLength; i++) {
    write(blockAddress + i, 0);
  }
  write(blockAddress, options.subcall & 0xff);
  if (options.seed) {
    for (let i = 0; i < options.seed.length && i + 1 < blockLength; i++) {
      write(blockAddress + 1 + i, options.seed[i]! & 0xff);
    }
  }
  return { blockAddress, blockLength };
}

export function readOswordBlock(
  read: (address: number) => number,
  blockAddress: number,
  blockLength: number,
): Uint8Array {
  const block = new Uint8Array(blockLength);
  for (let i = 0; i < blockLength; i++) {
    block[i] = read(blockAddress + i) & 0xff;
  }
  return block;
}

export function writeOswordZp(
  write: (address: number, value: number) => void,
  wordNumber: number,
  blockAddress: number,
): void {
  write(ZP.OSW_A, wordNumber & 0xff);
  write(ZP.OSW_X, blockAddress & 0xff);
  write(ZP.OSW_Y, (blockAddress >> 8) & 0xff);
}

export function writeOsbyteZp(
  write: (address: number, value: number) => void,
  code: number,
  x: number,
  y: number,
): void {
  write(ZP.OSW_A, code & 0xff);
  write(ZP.OSW_X, x & 0xff);
  write(ZP.OSW_Y, y & 0xff);
}

export function nullTerminatedAscii(block: Uint8Array, offset = 0): string {
  let end = offset;
  while (end < block.length && block[end] !== 0 && block[end] !== 0x0d) {
    end++;
  }
  return String.fromCharCode(...block.subarray(offset, end));
}
