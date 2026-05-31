# ROM unit test framework

Fast, deterministic unit tests for sideways ROM binaries using the **[jsbeeb](https://github.com/stardot/jsbeeb) 6502 core** (`fake6502` / `TEST_6502` model). No video, sound, VIA, or filing-system emulation — only mocked BBC MOS entry points.

## Prerequisites

- Node.js 18+
- `./bin/build.sh` — produces each configure-less ROM **and** matching BeebAsm `-labels` file

## Quick start

```bash
./bin/build.sh          # or --skip-testing to build only
cd bin/rom-unittest
npm install
npm test                # fails loudly if ROM/labels artefacts are missing
```

## Symbol labels

Hook addresses (`service`, `getrtc`, `writetd`) come **only** from BeebAsm `-d -labels` output. The harness does not scan ROM opcodes or skip missing builds.

| Module | Role |
|--------|------|
| `src/beebasm/labels.ts` | Parse BeebAsm label files |
| `src/cpu/jsbeeb-cpu.ts` | jsbeeb `fake6502` wrapper, flat 64 KiB map, RTS stack helpers |
| `src/mos/mos-mock.ts` | MOS vectors patched with `RTS`; hooks capture/stub calls before RTS runs |
| `src/harness/rom-test-harness.ts` | Load ROM at `$8000`, invoke service entry, run until return/BRK/limit |

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
import { RomTestHarness } from "./src/index.js";

const harness = new RomTestHarness({
  romPath: "dist/i2cbc.rom",
  labelsPath: "dist/i2cbc.labels",
});
```

## Tests

ROM unit tests live in **`src/tests/vitest/`** as `*.test.ts`. On-target BASIC and assembly tests are in **`src/tests/native/`**. Run Vitest from here via `npm test`.

## Notes

- jsbeeb **RTS adds one** to the stacked return address (correct 6502 JSR/RTS semantics). `pushReturnAddress()` accounts for this.
- Electron/AP6 variants are covered by the same test matrix (`bin/rom-unittest/src/rom-variants.ts`); each variant requires its ROM **and** `.labels` file.
