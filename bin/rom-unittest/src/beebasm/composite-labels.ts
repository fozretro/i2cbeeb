import type { BeebAsmSymbols } from "./labels.js";

/** Shift every BeebAsm symbol by the I²C module offset inside a composite ROM image. */
export function translateCompositeLabels(
  symbols: BeebAsmSymbols,
  imageOffset: number,
): BeebAsmSymbols {
  const translated = new Map<string, number>();
  for (const [name, address] of symbols) {
    translated.set(name, address + imageOffset);
  }
  return translated;
}

/** Serialise symbols in BeebAsm `-labels` format. */
export function formatBeebAsmLabels(symbols: BeebAsmSymbols): string {
  const entries = [...symbols.entries()].sort(([a], [b]) => a.localeCompare(b));
  const inner = entries.map(([name, addr]) => `'${name}':${addr}L`).join(",");
  return `[{${inner}}]\n`;
}
