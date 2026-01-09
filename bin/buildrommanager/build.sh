#!/bin/bash
set -e

# Source functions
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/inc/buildfunctions.sh"

# Set up absolute paths first
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
BEM_PATH="$PROJECT_ROOT/bin/b-em/b-em"
VDFS_DIR="$PROJECT_ROOT/dev/rommanager"
SOURCE_FILE="$PROJECT_ROOT/src.rommanager/rommanager.bas"
OUTPUT_DIR="$PROJECT_ROOT/src.rommanager/out"
REFERENCE_ROM="$PROJECT_ROOT/roms/ROMManager-v1.34.rom"
BUILD_DIR="$PROJECT_ROOT/bin/buildrommanager"
TMP_DIR="$BUILD_DIR/tmp"
BIN_DIR="$BUILD_DIR/bin"

# Parse command line arguments
TARGET=0
DEBUG=0
for arg in "$@"; do
    case "$arg" in
        --debug)
            DEBUG=1
            ;;
        [0-9]|[1-9][0-9]*)
            TARGET="$arg"
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: $0 [target] [--debug]"
            echo "  target: 0=Electron, 1=BBC B/B+, 3=Master, 5=Compact (default: 0)"
            echo "  --debug: Use OPT=00 (no auto-boot, emulator stays open)"
            exit 1
            ;;
    esac
done

# Set boot option based on debug flag
if [ "$DEBUG" -eq 1 ]; then
    BOOT_OPT="00"
else
    BOOT_OPT="03"
fi

echo "*** Building ROM Manager (Phase 1: Reproduce Existing ROM) ***"
echo "Target: $TARGET (0=Electron, 1=BBC B/B+, 3=Master, 5=Compact)"
echo "Boot option: OPT=$BOOT_OPT ($([ "$DEBUG" -eq 1 ] && echo "debug mode - emulator stays open" || echo "auto-boot enabled"))"
echo ""

# Create directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$VDFS_DIR"

# Clean and create tmp directory (clear old files to avoid confusion)
echo "Cleaning tmp directory..."
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Copy source file to tmp directory (no modifications)
echo "Preparing source file..."
TEMP_BASIC="$TMP_DIR/rommanager.bas"
cp "$SOURCE_FILE" "$TEMP_BASIC"

# Create !BOOT file with correct line endings (\r for BBC Micro)
echo "Creating !BOOT file..."
printf 'AB\rLOAD "rommgr"\r*QUIT\r' > "$TMP_DIR/!BOOT"

# Generate build.asm dynamically from binaries in bin directory
echo "Generating build.asm from binaries in bin directory..."

# Generate build.asm with !BOOT and rommgr entries
cat > "$TMP_DIR/build.asm" << 'EOF'
PUTTEXT "!BOOT", "!BOOT", &1900
PUTBASIC "rommanager.bas", "rommgr"
EOF

# Enumerate binary files in bin directory and add PUTFILE commands
if [ -d "$BIN_DIR" ]; then
    for binfile in "$BIN_DIR"/*; do
        # Skip if not a regular file or if it's a .inf file
        [ ! -f "$binfile" ] && continue
        [[ "$(basename "$binfile")" == *.inf ]] && continue
        
        binname=$(basename "$binfile")
        infile="$binfile.inf"
        
        if [ -f "$infile" ]; then
            parse_inf_file "$infile" "$binname"
        else
            echo "  Warning: No .inf file found for $binname, skipping"
        fi
    done
else
    echo "  No bin directory found, skipping binary files"
fi

# Build SSD with beebasm (tokenizes BASIC file)
echo "Building SSD with beebasm..."
cd "$TMP_DIR"

"$PROJECT_ROOT/bin/beebasm" -i "build.asm" -do build.ssd -title ROM 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Failed to build SSD"
    cd - > /dev/null
    exit 1
fi

# Extract all files from SSD to VDFS directory (emulator sees this)
# All files are added to SSD via beebasm (build.asm)
echo "Extracting files from SSD to VDFS directory..."

# Clean VDFS directory
rm -rf "$VDFS_DIR"/*
mkdir -p "$VDFS_DIR"

# Extract to tmp directory (not project root) to avoid cluttering project
# We're already in TMP_DIR from beebasm step, so stay here
# mmbutils getfile extracts ALL files from SSD into a directory
# Extract once (using first file) to get all files, then move what we need
extract_all_from_ssd

# Create rommanager.inf file for VDFS directory
# This controls boot options for the emulator (OPT=00 = no auto-boot, OPT=03 = auto-boot)
echo "Creating rommanager.inf file with OPT=$BOOT_OPT..."
printf '$.$ OPT=%s DIR=1 MDATE=D148 MTIME=06380F\n' "$BOOT_OPT" > "$VDFS_DIR.inf"

# Verify files are in VDFS directory
echo ""
echo "Files in VDFS directory (ready for emulator):"
ls -la "$VDFS_DIR"
echo ""
echo "Ready to run emulator..."
echo ""

echo "Running b-em emulator..."
if [ "$DEBUG" -eq 1 ]; then
    echo "NOTE: Debug mode - emulator will stay open (OPT=00, no auto-boot)"
else
    echo "NOTE: Auto-boot enabled (OPT=03) - !BOOT will execute automatically"
fi
echo ""

# Run emulator (BBC Model B with ARM CoPro for more RAM)
# -autoboot: Tell emulator to attempt to boot from disc (OPT setting controls !BOOT execution)
"$BEM_PATH" -autoboot

# Determine expected output filename based on target
case "$TARGET" in
    0) OUTPUT_ROM="AP6v134" ;;
    1) OUTPUT_ROM="SRAMv134B" ;;
    3) OUTPUT_ROM="SRAMv134M" ;;
    5) OUTPUT_ROM="SRAMv134C" ;;
    *) OUTPUT_ROM="AP6v134" ;;
esac

echo ""
echo "*** Checking for output ROM ***"

# The program saves the output itself, so it will be in the VDFS directory
OUTPUT_FOUND=""

if [ -f "$VDFS_DIR/$OUTPUT_ROM" ]; then
    OUTPUT_FOUND="$OUTPUT_ROM"
elif [ -f "$VDFS_DIR/${OUTPUT_ROM} " ]; then
    OUTPUT_FOUND="${OUTPUT_ROM} "
else
    # List files to help debug
    echo "✗ Output ROM not found: $OUTPUT_ROM"
    echo "  Available files in $VDFS_DIR:"
    ls -la "$VDFS_DIR" || true
    echo ""
    echo "  Searching for ROM files..."
    find "$VDFS_DIR" -type f -name "*v134*" -o -name "*AP6*" -o -name "*SRAM*" || true
    exit 1
fi

# Copy output ROM to output directory
cp "$VDFS_DIR/$OUTPUT_FOUND" "$OUTPUT_DIR/$OUTPUT_ROM"
echo "✓ ROM saved to $OUTPUT_DIR/$OUTPUT_ROM"

# Phase 1: Compare with reference ROM
if [ -f "$REFERENCE_ROM" ]; then
    echo ""
    echo "*** Comparing with reference ROM ***"
    if cmp -s "$OUTPUT_DIR/$OUTPUT_ROM" "$REFERENCE_ROM"; then
        echo "✓ Binary match: Output ROM is identical to $REFERENCE_ROM"
        echo ""
        echo "Phase 1 complete: Successfully reproduced existing ROM!"
    else
        echo "✗ Binary mismatch: Output ROM differs from $REFERENCE_ROM"
        echo ""
        echo "  File sizes:"
        ls -lh "$OUTPUT_DIR/$OUTPUT_ROM" "$REFERENCE_ROM"
        echo ""
        echo "  First 32 bytes comparison:"
        echo "  Output:"
        hexdump -C "$OUTPUT_DIR/$OUTPUT_ROM" | head -2
        echo "  Reference:"
        hexdump -C "$REFERENCE_ROM" | head -2
        exit 1
    fi
else
    echo "⚠ Reference ROM not found: $REFERENCE_ROM (skipping comparison)"
fi

echo ""
echo "Build complete!"
