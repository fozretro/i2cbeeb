---
name: i2cbeeb-build
description: Builds I2CBeeb and related Electron ROM artefacts in this repo. Use when validating changes before commit, when the user mentions BeebAsm, build.sh, Time-Config extract, AP6 build, ROM Manager / Plus 1 Support BAS pipelines, dist ROMs, or dev/eap6.
---

# I2CBeeb build workflow

Assume repo root `$REPO`; run shells from `$REPO` unless noted.

## Main I2CBeeb ROM pipeline

1. `./bin/time-config/extract.sh` pulls **Barney Hilken — Time‑Config.** from Codeberg into **`refs/Time-Config`** (gitignored **`/refs`**), pins commit in `TIMECONFIG_COMMIT`, copies/strips into **`src/configure/`**. **Requires:** `git`, `python3`, **network on first clone**.
2. **`./bin/build.sh`** runs that extract then BeebAsm compiles **`src/I2CBeeb.asm`** for BBC / Electron / EAP6 and test/configure variants into **`src/out/`**, runs **standalone ROM unit tests**, packages **`dist/`**, then runs **`./bin/buildap6/build.sh`** (unless **`--skip-ap6`**) so **`dist/ap6.rom`** matches the current I²C build. Auto-builds Plus 1 Support / ROM Manager if their **`bin/build*/out/`** artefacts are missing. Pass **`--skip-testing`** to omit Vitest and AP6 smoke tests. **Uses:** `./bin/beebasm`, `./bin/mmbutils/beeb`, **`node`/`npm`** for tests.

**Smoke check:** from `$REPO`, run `./bin/build.sh`; expect exits `0` and SSD/ROM artefacts updated under **`dist/`** (including **`ap6.rom`**) and **`dev/`** staging described in **`README.md`**.

## Electron AP6 support ROM amalgam

- Invoked automatically from **`./bin/build.sh`** unless **`--skip-ap6`**. Can also run standalone: **`./bin/buildap6/build.sh`**. Node SMJoin relocation pipeline; merges relocated I²C with Plus 1 stub, ROM Manager binary, **`roms/TUBEelk`** and **`roms/AP6Count`**; writes **`dist/ap6.rom`**, **`dist/ap6-i2c.labels`**, and **`dev/eap6/AP6`**. Step 4a runs **`npm run test:composite`** (**`ap6-composite` fixture only**). **`./bin/build.sh`** passes **`--skip-emulator-tests`** (Playwright/OCR **`smjoin-test.js`** skipped — Vitest is the primary gate). Run **`./bin/buildap6/build.sh`** without that flag to exercise emulator smoke manually. Flags **`--skip-i2c-build`**, **`--skip-testing`**, **`--skip-emulator-tests`** — see script **`--help`**.

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
| All I²C ROM variants + dev copies + standalone Vitest + AP6 amalgam | `./bin/build.sh` |
| Build only (no Vitest / AP6 tests) | `./bin/build.sh --skip-testing` |
| I²C ROMs only (no AP6 amalgam) | `./bin/build.sh --skip-ap6` |
| AP6 combined/support ROM pipeline alone | `./bin/buildap6/build.sh` |
| Composite fixture Vitest only | `cd bin/rom-unittest && npm run test:composite` |
| Standalone + composite matrix | `cd bin/rom-unittest && npm run test:all-fixtures` |
| Plus 1 Support ROM from BASIC | `./bin/buildplus1support/build.sh` |
| ROM Manager from BASIC | `./bin/buildrommanager/build.sh` |

For artefact filenames and behaviour, **`README.md`** (Building / distributions) is authoritative.
