#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BEEBASM="${BEEBASM:-$ROOT/bin/beebasm}"
ASM="$ROOT/src.i2ctest/i2ctest.asm"
OUT="src.i2ctest"
OUTDIR="$OUT/out"
ROM_NAME="I2CTROM"
EXEC_NAME="I2CT"

rm -f "$OUT/i2ctest.ssd" "$ROOT/$ROM_NAME" "$ROOT/$EXEC_NAME"
rm -rf "$OUTDIR"
mkdir -p "$OUTDIR/rom" "$OUTDIR/exec"

echo "*** Building I2CTEST minimal repro (ROM + EXEC) ***"

(
	cd "$OUTDIR/rom"
	"$BEEBASM" -i "$ASM" \
		-D TARGET=1 \
		-o "$ROM_NAME" \
		-d -labels "$ROOT/$OUTDIR/i2ctest-rom.labels"
)

(
	cd "$OUTDIR/exec"
	"$BEEBASM" -i "$ASM" \
		-D TARGET=2 \
		-o "$EXEC_NAME" \
		-d -labels "$ROOT/$OUTDIR/i2ctest-exec.labels"
)

echo "*** Building padded ROM images for hardware ***"
python3 - <<PY
import json
import re
from pathlib import Path

out = Path("src.i2ctest/out")
rom_name = "${ROM_NAME}"
exec_name = "${EXEC_NAME}"
rom_raw = (out / "rom" / rom_name).read_bytes()
exec_raw = (out / "exec" / exec_name).read_bytes()

def parse_labels(path: Path) -> dict[str, int]:
    text = path.read_text().replace("L", "")
    return json.loads(text.replace("'", '"'))[0]

def calc_crc(data: bytes) -> int:
    crc = 0
    for byte in data:
        crc ^= 256 * byte
        for _ in range(8):
            crc *= 2
            if crc > 65535:
                crc -= 65535
                crc ^= 0x1020
    return crc & 0xFFFF

def write_inf(path: Path, dfs_name: str, load: int, exec_addr: int, data: bytes) -> None:
    crc = calc_crc(data)
    path.write_text(f"\$.{dfs_name}    {load:04X}   {exec_addr:04X} CRC={crc:04X}\n")

if len(rom_raw) > 16384:
    raise SystemExit(f"{rom_name} is {len(rom_raw)} bytes; 16 KiB max")

if rom_raw[3] != 0x4C:
    raise SystemExit(f"{rom_name}: byte 3 is not JMP (\$4C)")
jmp_target = rom_raw[4] | (rom_raw[5] << 8)
if rom_raw[6] != 0x82:
    raise SystemExit(f"{rom_name}: ROM type byte \${rom_raw[6]:02X}, expected \$82")
if rom_raw[0:3] != bytes([0, 0, 0]):
    raise SystemExit(f"{rom_name}: language entry must be three zero bytes")

padded16 = rom_raw + bytes([0xFF] * (16384 - len(rom_raw)))
(out / f"{rom_name}-16k.rom").write_bytes(padded16)
(out / f"{rom_name}-32k.rom").write_bytes(padded16 + padded16)

exec_labels = parse_labels(out / "i2ctest-exec.labels")
exec_load = exec_labels["start"]
exec_run = exec_labels["runtests"]

write_inf(out / "rom" / f"{rom_name}.inf", rom_name, 0x8000, 0x8000, rom_raw)
write_inf(out / f"{rom_name}-16k.inf", rom_name, 0x8000, 0x8000, padded16)
write_inf(out / "exec" / f"{exec_name}.inf", exec_name, exec_load, exec_run, exec_raw)

print(f"  raw:  {len(rom_raw)} bytes")
print(f"  JMP:  \${jmp_target:04X}  type: \$82  copyr+\${rom_raw[7]:02X}")
print(f"  16k:  {out / f'{rom_name}-16k.rom'}")
print(f"  32k:  {out / f'{rom_name}-32k.rom'}")
print(f"  exec: {len(exec_raw)} bytes → {exec_name} (run \${exec_run:04X})")
PY

./bin/mmbutils/beeb blank_ssd "$OUT/i2ctest.ssd"
./bin/mmbutils/beeb putfile "$OUT/i2ctest.ssd" \
	"$OUTDIR/rom/$ROM_NAME" \
	"$OUTDIR/exec/$EXEC_NAME"

echo "*** Staging to dev/eap6 for hardware ***"
rm -f ./dev/eap6/R.I2CTEST ./dev/eap6/R.I2CTEST.inf \
	./dev/eap6/E.I2CTEST ./dev/eap6/E.I2CTEST.inf
cp "$OUTDIR/rom/$ROM_NAME" "./dev/eap6/$ROM_NAME"
cp "$OUT/out/${ROM_NAME}-16k.inf" "./dev/eap6/$ROM_NAME.inf"
cp "$OUTDIR/exec/$EXEC_NAME" "./dev/eap6/$EXEC_NAME"
cp "$OUTDIR/exec/$EXEC_NAME.inf" "./dev/eap6/$EXEC_NAME.inf"

echo "  ROM (16 KiB):           dev/eap6/$ROM_NAME  (*EELOAD $ROM_NAME E)"
echo "  ROM (32 KiB duplicate): src.i2ctest/out/${ROM_NAME}-32k.rom"
echo "  EXEC:                   dev/eap6/$EXEC_NAME  (*RUN $EXEC_NAME)"
echo "  SSD:                    src.i2ctest/i2ctest.ssd"
