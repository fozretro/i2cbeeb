# buildarmbas6502

Shared build tooling for projects that compile BBC/Electron ROMs using the **Archimedes Live** emulator and the **Arm BASIC 6502** (B6502) module.

## Usage

This directory is not run directly. Use one of the project build scripts:

- **ROM Manager:** `./bin/buildrommanager/build.sh` — builds `src.rommanager/rommanager.bas` → `buildrommanager/out/AP6v*.rom`
- **Plus 1 Support:** `./bin/buildplus1support/build.sh` — builds `src.plus1support/plus1support.bas` → `buildplus1support/out/AP1v*.rom`

Each project has a `config.json` that points at this shared `build.js` and at the correct `!Compile.*` script and source.

## Contents

- **build.js** — Playwright script: launch emulator, upload source + `!Compile` + `6502_BASIC`, run `*EXEC !Compile`, wait for `BUILD_END`, copy ROM to project `out/`.
- **bin/6502_BASIC** — Arm BASIC 6502 module (shared by all projects).

Each project has its own **bin/!Compile** (referenced via config `compileScriptPath`): ROM Manager chains AP6, Plus 1 Support chains AP1.

## Dependencies

- Node.js and npm
- Playwright (installed here via `npm install`)

Projects run: `node <this-dir>/build.js --config <project-dir>/config.json [--verbose]`.
