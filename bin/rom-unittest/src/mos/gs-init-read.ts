import type { JsbeebCpu } from "../cpu/types.js";
import { ZP } from "../bbc/mos.js";

function textPointer(cpu: JsbeebCpu): number {
  return cpu.readmem(ZP.CLI) | (cpu.readmem(ZP.CLI + 1) << 8);
}

function readCli(cpu: JsbeebCpu, offset: number): number {
  return cpu.readmem((textPointer(cpu) + offset) & 0xffff);
}

/** MOS GSINIT — skip spaces; Z set when the line is empty. */
export function gsinit(cpu: JsbeebCpu): void {
  let y = cpu.y & 0xff;
  while (true) {
    const char = readCli(cpu, y);
    if (char === 0x0d || char === 0) {
      cpu.p.z = true;
      break;
    }
    if (char !== 0x20 && char !== 0x09) {
      cpu.p.z = false;
      break;
    }
    y = (y + 1) & 0xff;
  }
  cpu.y = y & 0xff;
}

/** MOS GSREAD — read the next CLI character; C set at end of token (space or CR). */
export function gsread(cpu: JsbeebCpu): void {
  const y = cpu.y & 0xff;
  const char = readCli(cpu, y);
  cpu.y = (y + 1) & 0xff;
  if (char === 0x0d || char === 0 || char === 0x20) {
    cpu.a = char === 0x20 ? 0x20 : 0;
    cpu.p.c = true;
    return;
  }
  cpu.a = char & 0xff;
  cpu.p.c = false;
}
