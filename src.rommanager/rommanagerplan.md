# ROM Manager Build Plan

## Overview

The ROM Manager (`src.rommanager/rommanager.bas`) is a BBC BASIC program that needs to be executed on a BBC Micro (or emulator) to build the ROM. This document outlines the plan to create a build system similar to the one used previously for building I2C ROMs.

## Build Phases

### Phase 1: Reproduce Existing ROM (Current Goal)
**Objective:** Get the build system working to produce an **identical binary ROM** to `roms/ROMManager-v1.34.rom`

**Steps:**
1. Set up build system to compile `rommanager.bas`
2. Remove Archimedes BASIC V incompatible code (lines 7-9)
3. Build ROM for Electron target (TARGET%=0, default)
4. Compare output binary with `roms/ROMManager-v1.34.rom` using binary diff
5. Verify they are identical (or identify any differences)

**Success Criteria:** Binary output matches `roms/ROMManager-v1.34.rom` exactly

### Phase 2: Integrate NVRAM OSBYTE Support (Future)
**Objective:** Modify ROM Manager to use OSBYTE 161/162 (NVRAM read/write) instead of main RAM for configuration data

**Current RAM Usage (to be replaced with NVRAM):**
- `&0D6D` - ROM manager settings (LANG, Tube enable, etc.)
- `&0D6E` - INSERT/UNPLUG bitmap for ROMs 0-7
- `&0D6F` - INSERT/UNPLUG bitmap for ROMs 8-15

**Changes Needed:**

1. **I2CBeeb ROM - Remove duplicate commands:**
   - Remove `*INSERT` from command table (line 491-492 in `src/I2CBeeb.asm`)
   - Remove `*UNPLUG` from command table (line 493-494)
   - Remove `xinsert` handler code (lines 1776-1796)
   - Remove `xunplug` handler code (lines 1799-1819)
   - Keep `*CONFIGURE` and `*STATUS` (ROM Manager doesn't have these)
   - **Rationale:** Avoid command conflicts - ROM Manager handles INSERT/UNPLUG/ROMS, I2CBeeb handles CONFIGURE/STATUS and provides NVRAM via OSBYTE 161/162

2. **ROM Manager - Service Call 7 handler** (lines 309-353): Currently uses RAM locations `L0D6D-5+X` for OSBYTE &A1/&A2
   - Already implements OSBYTE &A1 (read) and &A2 (write) for locations 5, 6, 7, 15
   - **No changes needed** - ROM Manager's handler will not be called when I2CBeeb is higher priority
   - I2CBeeb's Service Call 7 handler (higher priority) will intercept OSBYTE 161/162 and use NVRAM
   
3. **ROM Manager - INSERT/UNPLUG commands** (lines 1012-1077): Currently use `L0D6E` and `L0D6F` RAM locations
   - Need to read/write via OSBYTE 161/162 instead of direct RAM access
   - When INSERT/UNPLUG call OSBYTE 161/162, I2CBeeb (higher priority) will handle it → uses NVRAM
   
4. **ROM Manager - ROMS command**: May need to read configuration via OSBYTE 161

**Implementation Approach:**
- Replace direct RAM access (`LDA L0D6D-5,X`, `STA L0D6D-5,X`) with OSBYTE calls
- Use OSBYTE 161 (&A1) for reading NVRAM
- Use OSBYTE 162 (&A2) for writing NVRAM
- Ensure compatibility with I2CBeeb ROM's NVRAM implementation (addresses 5, 6, 7, 15)

**ROM Priority in Combined AP6 ROM:**
- Current order in `bin/buildap6/config/smjoin-create-config.js`:
  1. AP1Plus (lowest priority)
  2. ROMManager
  3. TUBEelk
  4. I2C (higher priority than ROMManager) ✅
  5. AP6Count (highest priority)
- Service calls flow in reverse order (newest first), so I2CBeeb's Service Call 7 handler will be called before ROMManager's
- This means when INSERT/UNPLUG call OSBYTE 161/162, I2CBeeb will handle it (NVRAM) instead of ROMManager (RAM)
- **No changes needed to ROM order** - I2C is already positioned correctly above ROMManager

**I2CBeeb Command Table Cleanup:**
- **Current commands in I2CBeeb** (from Time-Config integration):
  - `*CONFIGURE` ✅ (keep - ROM Manager doesn't have this)
  - `*STATUS` ✅ (keep - ROM Manager doesn't have this)
  - `*INSERT` ❌ (remove - ROM Manager has this)
  - `*UNPLUG` ❌ (remove - ROM Manager has this)
- **Action needed for Phase 2:**
  - Remove `*INSERT` and `*UNPLUG` from I2CBeeb command table (lines 491-494)
  - Remove `xinsert` and `xunplug` handler code (lines 1776-1820)
  - Keep `*CONFIGURE` and `*STATUS` (ROM Manager doesn't implement these)
  - This avoids command conflicts - ROM Manager will handle INSERT/UNPLUG/ROMS, I2CBeeb handles CONFIGURE/STATUS

**Note:** This phase will only proceed after Phase 1 is complete and verified. The existing ROM Manager already has OSBYTE &A1/&A2 support in Service Call 7, but it currently reads/writes to RAM. When INSERT/UNPLUG are updated to use OSBYTE calls, I2CBeeb (higher priority) will intercept and use NVRAM instead.

## Important Compatibility Note

**⚠️ The source file contains Archimedes BASIC V code that needs modification:**

The file uses `OS_GetEnv` and `SYS` functions (lines 7-9) which are **Archimedes BASIC V** features, not available in **BBC BASIC 2** that the emulator supports. These lines need to be removed or modified to work on BBC BASIC 2.

**Lines to modify:**
```basic
IF PAGE>&8000:SYS "OS_GetEnv"TOA$:IFLEFT$(A$,5)<>"B6502":OSCLI"B6502"+MID$(A$,INSTR(A$," "))
A$=MID$(A$,1+INSTR(A$," ",1+INSTR(A$," ",1+INSTR(A$," "))))
TARGET$="":IFLEFT$(A$,7)="TARGET=":TARGET$=MID$(A$,8)
```

**Solution:**
- Remove or comment out these lines
- TARGET% will default to 0 (Electron) which is what we need
- If we need to support other targets, we can modify the source file before copying (e.g., using `sed` to change line 26)

**Target Platform:**
- Will run on **BBC Master emulation** (possibly with Tube mode enabled for more RAM)
- No Archimedes emulator available, so must work with BBC BASIC 2

## Historical Context

From commit `2695f52` (May 2024), the previous build system used:
- **b-em emulator** with VDFS (Virtual Disk Filing System) configured
- **!BOOT file** to automatically run assembly commands
- **Build script** to orchestrate the process

### Previous Build Pattern (from `refs/emulationbuilding/`)

**buildi2c.sh:**
```bash
# Auto launch b-em with /dev/i2c - assumes VDFS configured to point to /dev/i2c
cp ./src.i2c/i2c.asm ./dev/i2c/I2C
/Users/andrewfawcett/Documents/b-em/b-em/b-em -autoboot -sp9
tr -s '\r' < ./dev/i2c/I2COUT  | tr '\001' ' ' | tr '\f' ' ' | tr '\r' '\n'
```

**!BOOT:**
```
*DELETE I2CROM
*ASSEMBLE I2C -OI2CROM -FI2COUT -M0
*QUIT
```

## ROM Manager Build Requirements

### Source File Analysis

The ROM Manager (`src.rommanager/rommanager.bas`) is a BBC BASIC program that:
1. **Assembles machine code** in multiple passes (pass 0-3)
2. **Uses relocation table generation** via `PROCsm_table`
3. **Saves the ROM** using `*SAVE` with relocation data
4. **Uses `Stamp` command** to set file timestamp

Key sections:
- Lines 107-2163: Main assembly code with multiple passes
- Line 2160: `PROCsm_table` - generates relocation data
- Line 2161: `*SAVE` command - saves final ROM
- Line 2162: `Stamp` command - sets file timestamp

### Build Process

The ROM Manager needs to:
1. Run in BBC BASIC environment
2. Execute multiple assembly passes
3. Generate relocation table
4. Save output ROM file
5. Capture any errors/output

## Implementation Plan

### Step 1: Create Build Directory Structure

Create `/bin/buildrommanager/` directory:
```
bin/buildrommanager/
├── build.sh          # Main build script
├── dev/              # VDFS mount point (symlink to project dev/)
│   └── rommanager/   # Working directory for build
│       ├── !BOOT     # Auto-execute script
│       ├── rommanager.bas  # Source file (copied)
│       └── ROMOUT    # Output ROM file
└── README.md         # Build instructions
```

### Step 2: Create !BOOT File

The !BOOT file should:
1. Load and run the BASIC program
2. Capture output to a file
3. Exit cleanly

**Proposed !BOOT:**
```
*BASIC
CHAIN "rommanager"
*QUIT
```

**Note:** The ROM Manager program saves its output file directly using `OSCLI "*Save"`, so no need to redirect output. The saved ROM file will be in the VDFS directory.

### Step 3: Create Build Script

**Location:** `bin/buildrommanager/build.sh`

**Requirements:**
1. Copy source file to VDFS directory
2. Ensure !BOOT file exists
3. Run b-em emulator with appropriate flags
4. Extract output ROM file
5. Clean up temporary files
6. Handle errors gracefully

**Proposed script structure:**
```bash
#!/bin/bash
set -e

# Configuration
BEM_PATH="./bin/b-em/b-em"  # Use relative path to project b-em
# Or absolute: "/Users/andrewfawcett/Documents/b-em/b-em/b-em"
VDFS_DIR="./dev/rommanager"
SOURCE_FILE="./src.rommanager/rommanager.bas"
OUTPUT_DIR="./src.rommanager/out"

# Create output directory
mkdir -p "$OUTPUT_DIR"
mkdir -p "$VDFS_DIR"

# Remove Archimedes BASIC V incompatible code
# Lines 7-9 use OS_GetEnv and SYS which don't exist in BBC BASIC 2
# Create a modified version without these lines
sed -e '7,9d' "$SOURCE_FILE" > "$VDFS_DIR/rommanager.bas"

# Ensure !BOOT exists (created separately)
# TODO: Create !BOOT file

# Run emulator (BBC Master, possibly with Tube mode for more RAM)
"$BEM_PATH" -autoboot -sp9

# Extract output ROM
# The program saves the output itself, so it will be in the VDFS directory
# Output filename is determined by file$ variable in rommanager.bas
# For Electron (TARGET%=0): "AP6v134 " (space may be trimmed by filesystem)
OUTPUT_ROM="AP6v134"  # Default for Electron target
REFERENCE_ROM="./roms/ROMManager-v1.34.rom"

if [ -f "$VDFS_DIR/$OUTPUT_ROM" ]; then
    cp "$VDFS_DIR/$OUTPUT_ROM" "$OUTPUT_DIR/"
    echo "✓ ROM saved to $OUTPUT_DIR/$OUTPUT_ROM"
    
    # Phase 1: Compare with reference ROM
    if [ -f "$REFERENCE_ROM" ]; then
        echo ""
        echo "*** Comparing with reference ROM ***"
        if cmp -s "$OUTPUT_DIR/$OUTPUT_ROM" "$REFERENCE_ROM"; then
            echo "✓ Binary match: Output ROM is identical to $REFERENCE_ROM"
        else
            echo "✗ Binary mismatch: Output ROM differs from $REFERENCE_ROM"
            echo "  File sizes:"
            ls -lh "$OUTPUT_DIR/$OUTPUT_ROM" "$REFERENCE_ROM"
            echo "  First 32 bytes comparison:"
            hexdump -C "$OUTPUT_DIR/$OUTPUT_ROM" | head -2
            hexdump -C "$REFERENCE_ROM" | head -2
            exit 1
        fi
    else
        echo "⚠ Reference ROM not found: $REFERENCE_ROM (skipping comparison)"
    fi
else
    echo "✗ Output ROM not found: $VDFS_DIR/$OUTPUT_ROM"
    echo "  Available files in $VDFS_DIR:"
    ls -la "$VDFS_DIR" || true
    exit 1
fi

# Clean up
# TODO: Remove temporary files if needed
```

### Step 4: Determine Output Filename

The ROM Manager uses a variable `file$` (line 106) to determine the output filename:
```basic
file$=name$+"v"+LEFT$(ver$,1)+MID$(ver$,3,2)+MID$(" BBMEC",TARGET%+1,1)
```

Where:
- `name$="AP6"` for Electron (TARGET%=0), `"SRAM"` for others (line 42)
- `ver$="1.34"` (line 29)
- `LEFT$(ver$,1)` = "1" (first character)
- `MID$(ver$,3,2)` = "34" (characters 3-4)
- `MID$(" BBMEC",TARGET%+1,1)` = target suffix:
  - TARGET%=-1 (6502Em): position 0 -> " " (space)
  - TARGET%=0 (Electron): position 1 -> " " (space) 
  - TARGET%=1 (BBC B/B+): position 2 -> "B"
  - TARGET%=3 (Master): position 4 -> "M"
  - TARGET%=5 (Compact): position 6 -> "C"

**Important:** The program saves the output itself using `OSCLI "*Save"` (line 2161), so the output file will be in the current directory (VDFS mapped directory) when the emulator runs.

For Electron (TARGET%=0): `file$="AP6v134 "` (with trailing space, which may be trimmed by the filesystem)

The output file will be saved as `AP6v134` (or similar, space may be trimmed) in the VDFS directory (`dev/rommanager/`).

### Step 5: Handle Multiple Build Targets

The ROM Manager supports multiple targets via `TARGET%`:
- `TARGET%=-1`: 6502Em (no FDC, no real ADFS)
- `TARGET%=1`: BBC B/B+
- `TARGET%=3`: Master
- `TARGET%=5`: Compact
- `TARGET%=0`: Electron (default)

The build script should support building for different targets:
```bash
TARGET=${1:-0}  # Default to Electron
# Pass TARGET to rommanager.bas via environment or modify source
```

### Step 6: Integration with Existing Build System

Consider:
1. Should this be part of main `bin/build.sh`?
2. Or standalone `bin/buildrommanager/build.sh`?
3. How to handle dependencies (b-em must be installed)

## Files to Create

1. **`bin/buildrommanager/build.sh`** - Main build script
2. **`bin/buildrommanager/dev/rommanager/!BOOT`** - Auto-execute script
3. **`bin/buildrommanager/README.md`** - Build instructions
4. **`refs/emulationbuilding/`** - Reference files (already created)

## Dependencies

1. **b-em emulator** - Must be installed and accessible
2. **VDFS configuration** - Must be configured to point to project `dev/` directory
3. **BBC BASIC** - Included in b-em ROM set
4. **Lancs Assembler** - May be needed if rommanager.bas uses it (check source)

## Testing Plan

1. Test with Electron target (TARGET%=0)
2. Verify output ROM is generated correctly
3. Test with different targets
4. Verify relocation table is correct
5. Test error handling

## Compatibility Issues to Address

1. **Archimedes BASIC V code removal**: Lines 7-9 use `OS_GetEnv` and `SYS` which don't exist in BBC BASIC 2. These must be removed or commented out before building.

2. **TARGET parameter**: Since we're removing the command-line parsing, we have two options:
   - **Option A**: Keep default TARGET%=0 (Electron) - simplest, works for our needs
   - **Option B**: Modify source file before copying using `sed` to change line 26 for different targets
   
   Recommendation: Start with Option A (default Electron), add Option B later if needed for other targets.

## Open Questions

1. **Output filename**: The program saves it itself, but we need to determine the exact filename pattern. The trailing space in `file$` may be trimmed by the filesystem. Should we list files in VDFS directory after build to find the output?
2. **Error capture**: How to capture assembly errors? The program may print errors to screen. May need to capture emulator output.
3. **VDFS path**: What is the exact VDFS configuration needed? The old build used `/dev/i2c` - we'll use `/dev/rommanager` or similar.
4. **b-em path**: Should we use absolute path or relative path? The old build used absolute path, but we have `bin/b-em/b-em` available.
5. **Stamp command**: Is this available in b-em? May need to handle gracefully if not. This is just for file timestamp, not critical for build.
6. **BBC Master Tube mode**: Should we enable Tube mode in b-em for more RAM? The user mentioned this might be needed.

## Alternative Build Approach: Acorn Archimedes A5000

**Status:** Under consideration - needs verification that A5000 can build successfully

**Approach:**
1. Build `rommanager.bas` on Acorn Archimedes A5000 (native Archimedes BASIC V)
2. Save resulting ROM file to network share (`/Volumes/andrewfawcett` or `/Volumes/Econet`)
3. Copy ROM from network share to project directory
4. Integrate into AP6 ROM build process

**Advantages:**
- ✅ No compatibility issues - Archimedes BASIC V code (lines 7-9) works natively
- ✅ Builds on real hardware
- ✅ Network share accessible from macOS (`/Volumes/andrewfawcett` confirmed accessible)
- ✅ Can use full Archimedes BASIC V features

**Workflow:**
1. Copy `rommanager.bas` to A5000 (via network share or other method)
2. Run on A5000 with appropriate TARGET% setting
3. Save output ROM to network share (e.g., `/Volumes/andrewfawcett/i2cbeeb/roms/`)
4. From macOS, copy ROM from network share to `roms/` or `dist/` directory
5. Use existing AP6 build process to integrate ROM

**Network Share Locations:**
- `/Volumes/andrewfawcett` - Main user share (117GB available)
- `/Volumes/Econet` - Econet filesystem share

**Next Steps:**
- ⏳ Verify A5000 can successfully build `rommanager.bas`
- ⏳ Determine best location on network share for ROM files
- ⏳ Create script to copy ROM from network share to project
- ⏳ Integrate into existing build workflow

## Next Steps - Phase 1: Reproduce Existing ROM

**Option A: Emulator Build (Current)**
1. ✅ Copy reference files to `refs/emulationbuilding/`
2. ✅ Create this plan document
3. ✅ Document compatibility issues (Archimedes BASIC V code removal)
4. ✅ Document two-phase approach (reproduce ROM, then NVRAM integration)
5. ✅ Create `bin/buildrommanager/` directory structure
6. ✅ Create `!BOOT` file
7. ✅ Create `build.sh` script with Archimedes code removal
8. ⏳ Configure b-em emulator (Model, VDFS, Tube mode)
9. ⏳ Test with Electron target (default TARGET%=0)
10. ⏳ Verify BBC Master emulation works (with Tube mode if needed)
11. ⏳ Build ROM and compare with `roms/ROMManager-v1.34.rom`
12. ⏳ Verify binary match (or identify and fix differences)

**Option B: A5000 Build (Alternative)**
1. ⏳ Verify A5000 can build `rommanager.bas` successfully
2. ⏳ Set up network share location for ROM output
3. ⏳ Build ROM on A5000 for Electron target (TARGET%=0)
4. ⏳ Copy ROM from network share to project
5. ⏳ Compare with `roms/ROMManager-v1.34.rom`
6. ⏳ Verify binary match (or identify and fix differences)

## Future Steps - Phase 2: NVRAM Integration

1. ⏳ Analyze current INSERT/UNPLUG/ROMS implementation
2. ⏳ Identify RAM locations used for configuration storage
3. ⏳ Replace with OSBYTE 161/162 calls (NVRAM read/write)
4. ⏳ Test NVRAM integration with I2CBeeb ROM
5. ⏳ Verify configuration persists across reboots
6. ⏳ Update documentation

