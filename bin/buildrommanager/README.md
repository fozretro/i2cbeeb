# ROM Manager Build System

This directory contains the build system for building the ROM Manager ROM from `src.rommanager/rommanager.bas`.

## Overview

The ROM Manager is a BBC BASIC program that must be executed on a BBC Micro (or emulator) to build the ROM. This build system uses the b-em emulator to run the BASIC program and capture the output ROM.

## Prerequisites

1. **b-em emulator** - Must be installed and accessible at `./bin/b-em/b-em`
2. **VDFS configuration** - Must be configured in b-em to point to `./dev/rommanager`
3. **BBC BASIC** - Included in b-em ROM set

## Build Process

The build process:
1. Removes Archimedes BASIC V incompatible code (lines 7-9)
2. Optionally sets TARGET% for different build targets
3. Copies source file to VDFS directory
4. Runs b-em emulator with auto-boot
5. Extracts output ROM from VDFS directory
6. Compares with reference ROM (Phase 1 verification)

## Usage

### Basic Build (Electron target, default)

```bash
./bin/buildrommanager/build.sh
```

### Build for Different Targets

```bash
./bin/buildrommanager/build.sh 0  # Electron (default)
./bin/buildrommanager/build.sh 1  # BBC B/B+
./bin/buildrommanager/build.sh 3  # Master
./bin/buildrommanager/build.sh 5  # Compact
```

## b-em Configuration

**Important:** Before running the build, you need to configure b-em:

1. **Model Selection:**
   - For Electron builds: Use BBC Master 128 (model 10) or BBC Master 512 (model 11 for Tube mode)
   - Tube mode provides more RAM, which may be needed for the build

2. **VDFS Configuration:**
   - Enable VDFS in b-em settings
   - Set VDFS path to: `$(pwd)/dev/rommanager`
   - Or configure via b-em.cfg: `vdfsenable=true` and set the VDFS directory path

3. **Tube Mode (Optional):**
   - Enable Tube mode for more RAM if needed
   - Model 11 (BBC Master 512) has Tube mode enabled by default

### Configuring b-em

The build script will pause (`-sp9` flag) to allow you to configure b-em before it runs. You can:

1. **Set Model:** File → Model → BBC Master 128 (or Master 512)
2. **Enable VDFS:** File → Discs → VDFS → Enable
3. **Set VDFS Path:** File → Discs → VDFS → Set path to `./dev/rommanager`
4. **Enable Tube (Optional):** File → Tube → Select tube type (e.g., 6502 Internal)

Alternatively, you can configure b-em.cfg directly:
- Set `model=10` (BBC Master 128) or `model=11` (BBC Master 512)
- Set `vdfsenable=true`
- Set VDFS directory path

## Output

The output ROM will be saved to:
- `./src.rommanager/out/AP6v134` (for Electron target)
- `./src.rommanager/out/SRAMv134B` (for BBC B/B+ target)
- `./src.rommanager/out/SRAMv134M` (for Master target)
- `./src.rommanager/out/SRAMv134C` (for Compact target)

## Phase 1: Reproduce Existing ROM

The build script automatically compares the output with `./roms/ROMManager-v1.34.rom` to verify that the build reproduces the existing ROM exactly.

If the binaries match, Phase 1 is complete and you can proceed to Phase 2 (NVRAM integration).

## Troubleshooting

### Output ROM Not Found

If the build script can't find the output ROM:
1. Check that VDFS is enabled and pointing to the correct directory
2. Check that the !BOOT file exists in `./dev/rommanager/`
3. Check that `rommanager.bas` was copied correctly
4. Look at the emulator output for any errors

### Build Errors

If the build fails:
1. Check that b-em is installed and accessible
2. Check that the source file exists at `./src.rommanager/rommanager.bas`
3. Check that BBC BASIC is available in the emulator
4. Check emulator output for BASIC errors

### Binary Mismatch

If the output ROM doesn't match the reference:
1. Check that TARGET% is set correctly (should be 0 for Electron)
2. Check that Archimedes BASIC V code was removed correctly
3. Compare the hex dumps to identify differences
4. Verify that the build environment matches the original build environment

## Next Steps

Once Phase 1 is complete (binary match verified), proceed to Phase 2:
- Modify ROM Manager to use OSBYTE 161/162 (NVRAM) instead of RAM
- Remove duplicate commands from I2CBeeb ROM
- Test NVRAM integration

See `src.rommanager/rommanagerplan.md` for detailed Phase 2 plans.
