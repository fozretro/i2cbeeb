# ROM unit tests (Vitest)

Tests for the jsbeeb harness in `bin/rom-unittest/`. Run from **`bin/rom-unittest`** (`npm test`, etc.).

## Layout

| Folder | Fixture | npm project |
|--------|---------|-------------|
| `standalone/` | `i2cb`, `i2ce`, `i2ceap6` | `standalone` (default `npm test`) |
| `configure/` | `i2ceap6c` (standalone) or `dist/ap6.rom` (composite) | `standalone` / `composite` |
| `fixtures/ap6/` | `dist/ap6.rom` + `dist/ap6-i2c.labels` | `composite` |
| `fixtures/ap6-classic/` | `bin/buildap6/out/ap6-classic.rom` | `classic-only` / `classic-composite` |

Fixture-specific tests live only under their folder. Vitest **project include globs** select which folders run — not `describe.skipIf` or env-based variant switching inside test files.

Each file calls the matching resolver from `rom-variants.ts`:

- `requireConfiglessRomVariants()` — standalone config-less ROMs (`i2cb`, `i2ce`, `i2ceap6`)
- `requireConfigureFolderVariants()` — `configure/` tests: EAP6 INC_CONFIG ROM (standalone) or `dist/ap6.rom` (composite project sets `I2CBEEB_TEST_COMPOSITE=only`)
- `requireConfigureRomVariants()` — INC_CONFIG EAP6 ROM only
- `requireCompositeRomVariants()` — `dist/ap6.rom` amalgam (embedded I²C)
- `requireClassicCompositeVariants()` — ap6-classic amalgam

See `bin/rom-unittest/README.md` for npm scripts and build pipeline mapping.
