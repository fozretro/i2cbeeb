---
name: i2ctest-build
description: Builds the standalone AP6 I2C test repro in src.i2ctest (I2CTROM / I2CT). Use when editing i2ctest.asm, slot 12 EEPROM bug work, sharing the minimal repro, or running src.i2ctest Vitest — not the main ./bin/build.sh pipeline.
---

# I2CTest build workflow

Assume repo root `$REPO`. The shareable source is **`src.i2ctest/i2ctest.asm`** (standalone; header has BeebAsm commands).

## Targets

| `-D TARGET=` | Output | Use on hardware |
|--------------|--------|-----------------|
| `1` | `I2CTROM` sideways ROM (`&8000`) | `*EELOAD I2CTROM E`, `*COLD`, `*I2CTEST` |
| `2` | `I2CT` RAM utility (`&1900`) | `*RUN I2CT` |

## Repo build (artefacts + Vitest)

From `$REPO`:

```bash
./src.i2ctest/bin/build.sh
cd src.i2ctest/tests && npm test
```

**Produces:**

- `src.i2ctest/out/rom/I2CTROM`, `out/exec/I2CT` — raw binaries
- `src.i2ctest/out/I2CTROM-16k.rom` — padded for `*EELOAD`
- `src.i2ctest/out/*.labels` — BeebAsm labels for harness
- `dev/eap6/I2CT`, `dev/eap6/I2CTROM` — hardware staging
- `src.i2ctest/i2ctest.ssd` — optional DFS bundle

**Vitest:** 2 tests (ROM `*I2CTEST` + RAM `runExec`), 10 Pass lines each.

## Standalone share (asm file only)

From a directory containing **`i2ctest.asm`**:

```bash
beebasm -i i2ctest.asm -D TARGET=1 -o I2CTROM
beebasm -i i2ctest.asm -D TARGET=2 -o I2CT
```

BeebAsm writes **raw binary** to cwd (`-o` uses basename only). No `-do` disc image required.

## Hardware notes

- **Prefer `*RUN I2CT`** while investigating slot 12 ROM issues.
- **Avoid `*I2CTEST` in slot 12** — hangs on test 1; EEPROM corruption reported.
- Slot 12 is the AP6 I²C register (`&FCD6`) region; other slots work for `*I2CTEST`.

## When to run main build

Run **`./bin/build.sh`** only if you changed **`bin/rom-unittest/src/i2c/bus-mock.ts`** or other shared unittest code — not for i2ctest-only asm edits.

See **`.cursor/rules/i2ctest-minimal-repro.mdc`** for scope constraints.
