# ROM unit tests (Vitest)

Tests for the jsbeeb harness in `bin/rom-unittest/`. Run from **`bin/rom-unittest`** (`npm test`, etc.).

## Layout

| Folder | Fixture | npm project |
|--------|---------|-------------|
| `standalone/` | `i2cbc`, `i2cec`, `i2ceap6c` | `standalone` (default `npm test`) |
| `configure/` | `i2ceap6c` INC_CONFIG ROM | `standalone` |
| `fixtures/ap6/` | `dist/ap6.rom` + `dist/ap6-i2c.labels` | `composite` |
| `fixtures/ap6-classic/` | `dist/ap6-classic.rom` | `classic-only` / `classic-composite` |

Fixture-specific tests live only under their folder. Vitest **project include globs** select which folders run — not `describe.skipIf` or env-based variant switching inside test files.

Each file calls the matching resolver from `rom-variants.ts`:

- `requireConfiglessRomVariants()` — standalone configure-less ROMs
- `requireConfigureRomVariants()` — INC_CONFIG EAP6 ROM
- `requireCompositeRomVariants()` — `dist/ap6.rom` amalgam (embedded I²C)
- `requireClassicCompositeVariants()` — ap6-classic amalgam

See `bin/rom-unittest/README.md` for npm scripts and build pipeline mapping.
