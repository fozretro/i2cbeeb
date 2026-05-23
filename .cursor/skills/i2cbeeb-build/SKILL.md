---
name: i2cbeeb-build
description: Builds I2CBeeb and related Electron ROM artefacts in this repo. Use when validating changes before commit, when the user mentions BeebAsm, build.sh, Time-Config extract, AP6 build, ROM Manager / Plus 1 Support BAS pipelines, dist ROMs, or dev/eap6.
---

# I2CBeeb build workflow

Assume repo root `$REPO`; run shells from `$REPO` unless noted.

## Main I2CBeeb ROM pipeline

1. `./bin/time-config/extract.sh` pulls **Barney Hilken — Time‑Config.** from Codeberg into **`refs/Time-Config`** (gitignored **`/refs`**), pins commit in `TIMECONFIG_COMMIT`, copies/strips into **`src/configure/`**. **Requires:** `git`, `python3`, **network on first clone**.
2. **`./bin/build.sh`** runs that extract then BeebAsm compiles **`src/I2CBeeb.asm`** for BBC / Electron / EAP6 and test/configure variants into **`dist/`**, **`src/out/`**, **`dev/`** staging. **Uses:** `./bin/beebasm`, `./bin/mmbutils/beeb`.

**Smoke check:** from `$REPO`, run `./bin/build.sh`; expect exits `0` and SSD/ROM artefacts updated under `dist/` and dev folders described in **`README.md`**.

## Electron AP6 support ROM bundle (optional / heavier)

- **`./bin/buildap6/build.sh`** — Node SMJoin relocation pipeline (`npm install` under **`bin/buildap6`**), merges I²C ROM with Plus1 / ROM Manager / other AP6 components. Supports flags like **`--skip-i2c-build`**, **`--skip-testing`** (see script `--help`).
- Depends on artefacts from the main BeebAsm build when not skipping I²C steps.

## JGH BASIC sources (Plus 1 Support / ROM Manager)

Detached from **`I2CBeeb.asm`** unless separately wired elsewhere; built with **`bin/buildarmbas6502`** (Node ARM BASIC 6502 tooling).

- `./bin/buildplus1support/build.sh` — consumes **`src.plus1support/plus1support.bas`** → **`bin/buildplus1support/out/`** (gitignored).
- `./bin/buildrommanager/build.sh` — consumes **`src.rommanager/rommanager.bas`** → **`bin/buildrommanager/out/`** (gitignored).

**Requires:** `node`, `npm`; first run installs deps in **`bin/buildarmbas6502`**.

Console labels like `AP1v131` / `AP6v134` may reflect **config** filenames; rely on **`REM >`** / `ver$` headers in `.bas`, not artefact prefixes alone.

## Hygiene notes

- Do not commit **`refs/`** clones or scratch (`/refs` is in **`.gitignore`**).
- Do not commit **`node_modules/`**, **`bin/build*/out/`**, **`src/out/`** per **`.gitignore`**.
- If Time-Config commit changes, update **`bin/time-config/extract.sh`** `TIMECONFIG_COMMIT` deliberately so builds stay reproducible.

## Fast reference

| Goal | Command |
|------|---------|
| All I²C ROM variants + dev copies | `./bin/build.sh` |
| AP6 combined/support ROM pipeline | `./bin/buildap6/build.sh` |
| Plus 1 Support ROM from BASIC | `./bin/buildplus1support/build.sh` |
| ROM Manager from BASIC | `./bin/buildrommanager/build.sh` |

For artefact filenames and behaviour, **`README.md`** (Building / distributions) is authoritative.
