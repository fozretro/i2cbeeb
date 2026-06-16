# Configure ROM Cleanup

Remove the redundant BBC/Electron "configure-less" ROM duplicates and make the
Electron AP6 standalone ROM genuinely config-less, so the `c` suffix means
"Configure-enabled" and only exists where the platform supports it (AP6 / PCF8583).

## Background

- `i2cbc.rom` (`C.I2CB`) and `i2cec.rom` (`C.I2CE`) are byte-identical to
  `i2cb.rom` / `i2ce.rom` — BBC and basic Electron have no NVRAM, so `*CONFIGURE`
  is disabled (`INC_CONFIG=0`) on both production and `C.` builds. The `C.` builds
  only survived because they emitted the BeebAsm `.labels` symbol files the Vitest
  ROM unit tests consume.
- `i2ceap6.rom` (`I2CEAP6`) currently ships with `INC_CONFIG=1` — same as the
  `C.I2CEAP6` build — so the AP6 pair is also identical today.

## Target state

- BBC/Electron: a single ROM each (`i2cb.rom`, `i2ce.rom`), built with
  `-d -labels` so tests get their symbols. `i2cbc.rom` / `i2cec.rom` deleted.
- AP6: `i2ceap6.rom` becomes config-less (`INC_CONFIG=0`); `i2ceap6c.rom`
  (`C.I2CEAP6`, `INC_CONFIG=1`) remains the configure-enabled variant + test ROM.
- The AP6 amalgam (`ap6.rom`) is unaffected — it builds its own `INC_CONFIG=1`
  I²C slice in `bin/buildap6/smjoin-build-i2c-rom.sh`.

## Completed Tasks

- [x] Write this task file
- [x] `bin/build.sh`: added `-d -labels` to `I2CB` / `I2CE` / `I2CEAP6`; set EAP6
      `INC_CONFIG=0`; removed `C.I2CB` / `C.I2CE` builds, SSD putfiles, dist + dev
      copies; copy new `.labels` to dist; kept `C.I2CEAP6` (configure variant)
- [x] `bin/rom-unittest/src/rom-variants.ts`: repointed `CONFIGLESS_ROM_VARIANTS`
      to `i2cb` / `i2ce` / `i2ceap6` (production ROM + labels); kept
      `CONFIGURE_ROM_VARIANTS` = `i2ceap6c`
- [x] Docs: `README.md` table + footnotes + AP6 usage prose,
      `bin/rom-unittest/README.md`, `src/tests/vitest/README.md`,
      `.cursor/rules/vitest-rom-tests.mdc`, `.cursor/skills/i2cbeeb-build/SKILL.md`,
      `labels.test.ts` comments
- [x] Deleted stale artefacts: `dist/i2cbc.*`, `dist/i2cec.*`,
      `dev/eap6/C.I2CB*`, `dev/eap6/C.I2CE*`, `dev/roms/C.I2CB*`, `dev/roms/C.I2CE*`
- [x] `./bin/build.sh` clean (exit 0): standalone Vitest **73 passed**, classic
      **8 passed**; verified `i2ceap6.rom` (config-less) now differs from
      `i2ceap6c.rom`, and `dist/i2cb.labels` / `i2ce.labels` / `i2ceap6.labels` emitted
- [x] Follow-up dead-code cleanup in `rom-variants.ts`: removed deprecated
      `requireRomVariants` + orphaned `appendCompositeWhenEnabled`, narrowed
      `compositeTestMode` to `"only" | "off"`, dropped the `requireRomVariants`
      re-export from `index.ts` (no `I2CBEEB_TEST_COMPOSITE=append` consumer exists).
      Re-ran `npm test` → **73 passed**. (Pre-existing, unrelated `tsc` error in
      `fixtures/ap6-classic/lang-tube-amalgam.test.ts:195` left untouched.)

## Relevant Files

- `bin/build.sh` — ROM build/packaging pipeline
- `bin/rom-unittest/src/rom-variants.ts` — Vitest ROM variant definitions
- `src/tests/vitest/standalone/*.test.ts` — consume `requireConfiglessRomVariants()`
- `README.md` — distribution table + AP6 usage notes
- `bin/rom-unittest/README.md`, `src/tests/vitest/README.md` — fixture docs
- `.cursor/rules/vitest-rom-tests.mdc`, `.cursor/skills/i2cbeeb-build/SKILL.md`
