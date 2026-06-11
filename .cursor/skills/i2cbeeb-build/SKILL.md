---
name: i2cbeeb-build
description: Builds I2CBeeb and related Electron ROM artefacts in this repo. Use when validating changes before commit, when the user mentions BeebAsm, build.sh, Time-Config extract, AP6 build (i2c or classic layout), ROM Manager / Plus 1 Support BAS pipelines, dist ROMs, Vitest composite/classic fixtures, or dev/eap6.
---

# I2CBeeb build workflow

Assume repo root `$REPO`; run shells from `$REPO` unless noted.

## Main I2CBeeb ROM pipeline

1. `./bin/time-config/extract.sh` pulls **Barney Hilken — Time‑Config.** from Codeberg into **`refs/Time-Config`** (gitignored **`/refs`**), pins commit in `TIMECONFIG_COMMIT`, copies/strips into **`src/configure/`**. **Requires:** `git`, `python3`, **network on first clone**.
2. **`./bin/build.sh`** runs that extract then BeebAsm compiles **`src/I2CBeeb.asm`** for BBC / Electron / EAP6 and test/configure variants into **`src/out/`**, runs **standalone ROM unit tests** (`npm test`, 72 tests on `i2cbc` / `i2cec` / `i2ceap6c`), packages **`dist/`**, then runs **`./bin/buildap6/build.sh`** twice (unless **`--skip-ap6`**) for **`dist/ap6.rom`** (i2c + composite Vitest, 18 tests) and **`bin/buildap6/out/ap6-classic.rom`** followed by **`npm run test:classic-only`** (7 LANG/TUBE tests). Auto-builds Plus 1 Support / ROM Manager if their **`bin/build*/out/`** artefacts are missing. Pass **`--skip-testing`** to omit Vitest and AP6 smoke tests. **Uses:** `./bin/beebasm`, `./bin/mmbutils/beeb`, **`node`/`npm`** for tests.

**Smoke check:** from `$REPO`, run `./bin/build.sh`; expect exits `0` and SSD/ROM artefacts updated under **`dist/`** (including **`ap6.rom`**) and **`dev/`** staging described in **`README.md`**. Classic amalgam test fixture under **`bin/buildap6/out/`** (gitignored).

## Electron AP6 support ROM amalgam

Layout selected by **`--layout`** on **`./bin/buildap6/build.sh`** (or **`AP6_SMJOIN_LAYOUT`**). Config router: **`bin/buildap6/config/smjoin-create-config.js`** → **`bin/buildap6/config/layouts/i2c.js`** or **`classic.js`**.

**`./bin/build.sh`** (unless **`--skip-ap6`**) runs **both** layouts in sequence: i2c then classic. Each can also be run alone via **`./bin/buildap6/build.sh`** / **`./bin/buildap6/build.sh --layout classic`**.

### I²C layout — first AP6 step in `./bin/build.sh`

- SMJoin merges relocated I²C with Plus 1 Support, ROM Manager, **`roms/TUBEelk`**, **`roms/AP6Count`**.
- Writes **`dist/ap6.rom`**, **`dist/ap6-i2c.labels`** (via **`emit-ap6-i2c-labels.js`** — shifts standalone I²C BeebAsm labels by the embedded slice offset), and **`dev/eap6/AP6`**.
- Step 4a: **`npm run test:composite`** — Vitest project **`composite`** (`fixtures/ap6/` only, 18 tests).
- Invoked from **`./bin/build.sh`** (first AP6 step) unless **`--skip-ap6`**. **`./bin/build.sh`** passes **`--skip-emulator-tests`** (Playwright/OCR **`smjoin-test.js`** skipped). Run **`./bin/buildap6/build.sh`** without that flag for emulator smoke manually.
- Flags: **`--skip-i2c-build`**, **`--skip-testing`**, **`--skip-emulator-tests`** — see **`--help`**.

### Classic layout — second AP6 step in `./bin/build.sh`

- TreeCopy slot uses **`roms/TreeROM-v1.62.rom`** (relocatable). **AP6Count omitted** — 1.62 does not fit in 16 KiB with the other modules (1.61 + AP6Count fits; see layout comment).
- Writes **`bin/buildap6/out/ap6-classic.rom`** and **`dev/eap6/AP6-classic`** (no I²C pre-build; steps 1–2 skipped). Output is a test fixture only — not copied to **`dist/`**.
- Step 4a-classic: **`npm run test:classic-composite`** — Vitest project **`classic-composite`** (standalone + **`fixtures/ap6-classic/`**, 79 tests). **`./bin/build.sh`** uses **`npm run test:classic-only`** instead (7 tests only — standalone already ran).
- Also invoked by **`./bin/buildap6/build.sh --layout classic`** alone.

### Composite test entry points (no module-offset manifest)

Embedded ROMs are SMJoin-chained; tests use the amalgam **`$8003`** service entry (classic LANG/TUBE) or relocated I²C labels (**`dist/ap6-i2c.labels`**). Do not use per-module image-offset manifests.

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
| Standalone I²C ROMs + dev copies + standalone Vitest + **both** AP6 amalgams (i2c + classic) + Vitest gates | `./bin/build.sh` |
| Build only (no Vitest / AP6 tests) | `./bin/build.sh --skip-testing` |
| I²C ROMs only (no AP6 amalgam) | `./bin/build.sh --skip-ap6` |
| **I²C** AP6 amalgam pipeline alone | `./bin/buildap6/build.sh` |
| **Classic** AP6 amalgam + classic LANG/TUBE Vitest | `./bin/buildap6/build.sh --layout classic` |
| AP6 amalgam Vitest (`fixtures/ap6/`) | `cd bin/rom-unittest && npm run test:composite` |
| Classic LANG/TUBE only (after standalone Vitest) | `cd bin/rom-unittest && npm run test:classic-only` |
| Standalone + **i2c** composite in one Vitest run | `cd bin/rom-unittest && npm run test:all-fixtures` |
| Plus 1 Support ROM from BASIC | `./bin/buildplus1support/build.sh` |
| ROM Manager from BASIC | `./bin/buildrommanager/build.sh` |

For artefact filenames and behaviour, **`README.md`** (Building / distributions) and **`bin/rom-unittest/README.md`** (fixtures) are authoritative.
