import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** BeebAsm symbol table (`-d -labels <file>`). Keys are lower-case label names. */
export type BeebAsmSymbols = ReadonlyMap<string, number>;

const REQUIRED_RTC_SYMBOLS = ["getrtc", "writetd", "wtbrk"] as const;
const SERVICE_SYMBOL = "service";

/**
 * Parse BeebAsm `-labels` output.
 * Format: `[{'label':32768L,'other':32804L,...}]`
 */
export function parseBeebAsmLabels(content: string): BeebAsmSymbols {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("BeebAsm labels file is empty");
  }

  const jsonLike = trimmed.replace(/(\d+)L/g, "$1").replace(/'/g, '"');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLike);
  } catch (error) {
    throw new Error(`Failed to parse BeebAsm labels: ${error instanceof Error ? error.message : error}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0] !== "object" || parsed[0] === null) {
    throw new Error("BeebAsm labels file has unexpected structure");
  }

  const symbols = new Map<string, number>();
  for (const [name, value] of Object.entries(parsed[0] as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 0xffff) {
      throw new Error(`Invalid address for label ${name}: ${String(value)}`);
    }
    symbols.set(name.toLowerCase(), value);
  }
  return symbols;
}

export function loadBeebAsmLabels(labelsPath: string): BeebAsmSymbols {
  const content = readFileSync(resolve(labelsPath), "utf8");
  return parseBeebAsmLabels(content);
}

export function symbolAddress(symbols: BeebAsmSymbols, name: string): number | null {
  return symbols.get(name.toLowerCase()) ?? null;
}

export function requireSymbolAddress(symbols: BeebAsmSymbols, name: string): number {
  const address = symbolAddress(symbols, name);
  if (address === null) {
    throw new Error(`BeebAsm labels file has no symbol ${name}`);
  }
  return address;
}

export function rtcHookAddresses(symbols: BeebAsmSymbols): {
  getrtc: number;
  writetd: number;
  wtbrk: number;
} {
  return {
    getrtc: requireSymbolAddress(symbols, REQUIRED_RTC_SYMBOLS[0]),
    writetd: requireSymbolAddress(symbols, REQUIRED_RTC_SYMBOLS[1]),
    wtbrk: requireSymbolAddress(symbols, REQUIRED_RTC_SYMBOLS[2]),
  };
}

export function serviceEntryAddress(symbols: BeebAsmSymbols): number {
  return requireSymbolAddress(symbols, SERVICE_SYMBOL);
}

export function configureHookAddresses(symbols: BeebAsmSymbols): {
  framReadByte: number | null;
  framWriteByte: number | null;
  readKeySwitches: number | null;
} {
  return {
    framReadByte: symbolAddress(symbols, "fram_readbyte"),
    framWriteByte: symbolAddress(symbols, "fram_writebyte"),
    readKeySwitches: symbolAddress(symbols, "con_readkeyswitches"),
  };
}

const REQUIRED_I2C_BUS_SYMBOLS = [
  "i2cstart",
  "i2cstop",
  "i2caddr",
  "i2crxack",
  "i2ctxack",
  "i2crxbyte",
  "i2ctxbyte",
  "i2creset",
] as const;

export function i2cBusHookAddresses(symbols: BeebAsmSymbols): {
  i2cstart: number;
  i2cstop: number;
  i2caddr: number;
  i2crxack: number;
  i2ctxack: number;
  i2crxbyte: number;
  i2ctxbyte: number;
  i2creset: number;
} {
  return {
    i2cstart: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[0]),
    i2cstop: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[1]),
    i2caddr: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[2]),
    i2crxack: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[3]),
    i2ctxack: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[4]),
    i2crxbyte: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[5]),
    i2ctxbyte: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[6]),
    i2creset: requireSymbolAddress(symbols, REQUIRED_I2C_BUS_SYMBOLS[7]),
  };
}

export { formatBeebAsmLabels, translateCompositeLabels } from "./composite-labels.js";
