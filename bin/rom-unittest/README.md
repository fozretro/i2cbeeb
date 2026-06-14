# ROM unit test framework

Fast, deterministic unit tests for sideways ROM binaries using the **[jsbeeb](https://github.com/stardot/jsbeeb) 6502 core** (`fake6502` / `TEST_6502` model). No video, sound, VIA, or filing-system emulation — only mocked BBC MOS entry points.

## Prerequisites

- Node.js 18+
- **`./bin/build.sh`** — standalone I²C ROMs + labels; also runs **`./bin/buildap6/build.sh`** (i2c then classic) unless **`--skip-ap6`**
- **`./bin/buildap6/build.sh --layout classic`** — classic layout only (same as the second AP6 step in **`./bin/build.sh`**)

## Quick start

```bash
./bin/build.sh          # standalone Vitest (73) + composite (28) + classic (7)
cd bin/rom-unittest
npm install
npm test                # standalone fixtures only — fails if ROM/labels absent
```

## Symbol labels

Hook addresses (`service`, `getrtc`, `writetd`, FRAM hooks) come **only** from BeebAsm `-d -labels` output (standalone ROMs) or **`dist/ap6-i2c.labels`** (relocated I²C slice in the amalgam). The harness does not scan ROM opcodes or skip missing builds.

| Module | Role |
|--------|------|
| `src/beebasm/labels.ts` | Parse BeebAsm label files |
| `src/cpu/jsbeeb-cpu.ts` | jsbeeb `fake6502` wrapper, flat 64 KiB map, RTS stack helpers |
| `src/mos/mos-mock.ts` | MOS vectors patched with `RTS`; hooks capture/stub calls before RTS runs |
| `src/harness/rom-test-harness.ts` | Load ROM at `$8000`, invoke service entry, run until return/BRK/limit |
| `src/harness/ap6-classic-amalgam.ts` | Shared CPU for **`ap6-classic.rom`**; composite **`$8003`** entry |
| `src/harness/classic-serv7-osbyte.ts` | OSBYTE 161/162 shadow store for classic LANG/TUBE tests |

### MOS mocking

Vectors at `$FFE0`–`$FFF7` are patched to `RTS` ($60). `debugInstruction` hooks run **before** RTS executes (same pattern as jsbeeb's own test suite):

- **OSWRCH / OSASCI / OSNEWL** → capture output characters
- **OSBYTE / OSWORD** → configurable canned handlers (`stubOsbyte`, `stubOsword`)
- **OSCLI** → record invocations
- **Unstubbed MOS call** → `cpu.stop()`, test fails with `unexpected-mos`

### Stop conditions

`run()` / `invokeService()` stop when:

- PC reaches the harness return trampoline (`$0200`, default)
- `BRK` / `cpu.stop()` (unexpected MOS)
- `maxCycles` / `maxInstructions` exceeded

## Example usage

```typescript
import { I2CBeebRomTestHarness } from "./src/index.js";

const harness = new I2CBeebRomTestHarness({
  romPath: "dist/i2cbc.rom",
  labelsPath: "dist/i2cbc.labels",
});
```

## Tests

ROM unit tests live in **`src/tests/vitest/`** — see **`src/tests/vitest/README.md`** for folder layout. On-target BASIC and assembly tests are in **`src/tests/native/`**. Run Vitest from **`bin/rom-unittest`**.

Vitest **projects** in **`vitest.config.ts`** select which folders run (no env-based `skipIf` in test files).

| Command | Vitest project | Fixture(s) | Typical count |
|---------|----------------|------------|---------------|
| `npm test` | `standalone` | `i2cbc`, `i2cec`, `i2ceap6c` + configure ROM | **73** |
| `npm run test:composite` | `composite` | **`ap6`** (`fixtures/ap6/` + `configure/`) | **28** |
| `npm run test:classic-composite` | `classic-composite` | standalone + **`ap6-classic`** | **79** |
| `npm run test:classic-only` | `classic-only` | **`ap6-classic`** only | **7** |
| `npm run test:all-fixtures` | standalone + composite + classic-only | full matrix (no duplicate classic-composite) | **108** |

**Build pipeline mapping**

| Build step | Vitest command |
|------------|----------------|
| `./bin/build.sh` (before AP6) | `npm test` |
| `./bin/buildap6/build.sh` (i2c, default) | `npm run test:composite` |
| `./bin/buildap6/build.sh --layout classic` | `npm run test:classic-composite` |
| `./bin/build.sh` (full) | `npm test` + `test:composite` + `test:classic-only` |

Variant lists: **`src/rom-variants.ts`**. Each test file calls the resolver matching its folder (`requireConfiglessRomVariants`, `requireCompositeRomVariants`, etc.).

### Test folder layout

| Folder | ROM fixture |
|--------|-------------|
| `standalone/` | `i2cbc`, `i2cec`, `i2ceap6c` |
| `configure/` | INC_CONFIG EAP6 configure ROM (standalone) or `dist/ap6.rom` (composite) |
| `fixtures/ap6/` | `dist/ap6.rom` + `dist/ap6-i2c.labels` |
| `fixtures/ap6-classic/` | `bin/buildap6/out/ap6-classic.rom` |

### Fixture behaviour

- **Standalone** — single sideways I²C image at `$8000` + BeebAsm labels (`help`, `datetime`, `tbrk`).
- **`fixtures/ap6/`** — `configure-nvram.test.ts` (relocated I²C `service` / FRAM hooks) and `lang-tube-amalgam.test.ts` (real `*CONFIGURE` via embedded I²C + amalgam `$8003`). Rebuild **`dist/ap6.rom`** after ROM Manager changes.
- **`fixtures/ap6-classic/`** — no `*CONFIGURE` in ROM; use **`writeNVRAMStore`** / **`writeClassicServ7TubeEnabled`** for NVRAM store setup.

## Notes

- jsbeeb **RTS adds one** to the stacked return address (correct 6502 JSR/RTS semantics). `pushReturnAddress()` accounts for this.
- Electron/AP6 standalone variants require ROM **and** `.labels` file (`rom-variants.ts`). Classic composite requires **`bin/buildap6/out/ap6-classic.rom`** only.
