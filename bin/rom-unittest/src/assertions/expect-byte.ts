import { expect } from "vitest";

export interface MemoryReader {
  readMemory(address: number): number;
}

export type ExpectByteOptions = {
  /** Compare only these bits (default: full byte). */
  mask?: number;
};

function assertByte(actual: number, expected: number, options?: ExpectByteOptions): void {
  if (options?.mask !== undefined) {
    expect(actual & options.mask).toBe(expected & options.mask);
  } else {
    expect(actual).toBe(expected & 0xff);
  }
}

/** Assert a RAM byte via {@link MemoryReader.readMemory}. */
export function expectByte(
  reader: MemoryReader,
  address: number,
  expected: number,
  options?: ExpectByteOptions,
): void {
  assertByte(reader.readMemory(address), expected, options);
}

/** Assert a byte in a mocked NVRAM image (PCF8583 store). */
export function expectNvramByte(
  image: Uint8Array,
  address: number,
  expected: number,
  options?: ExpectByteOptions,
): void {
  assertByte(image[address]!, expected, options);
}
