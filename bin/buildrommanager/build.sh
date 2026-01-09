#!/bin/bash
set -e

# Configuration
BEM_PATH="./bin/b-em/b-em"
VDFS_DIR="./dev/rommanager"
SOURCE_FILE="./src.rommanager/rommanager.bas"
OUTPUT_DIR="./src.rommanager/out"
REFERENCE_ROM="./roms/ROMManager-v1.34.rom"
BUILD_DIR="./bin/buildrommanager"
TMP_DIR="$BUILD_DIR/tmp"

# Default target (0 = Electron)
TARGET=${1:-0}

echo "*** Building ROM Manager (Phase 1: Reproduce Existing ROM) ***"
echo "Target: $TARGET (0=Electron, 1=BBC B/B+, 3=Master, 5=Compact)"
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
# REM out *QUIT so emulator stays open to see errors
# Use LOAD instead of CHAIN to load the program
echo "Creating !BOOT file..."
printf '*BASIC\rLOAD "rommgr"\rREM *QUIT\r' > "$TMP_DIR/!BOOT"

# Generate build.asm dynamically from binaries in bin directory
echo "Generating build.asm from binaries in bin directory..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BIN_DIR="$BUILD_DIR/bin"

# Start build.asm with header and !BOOT/rommgr entries
cat > "$TMP_DIR/build.asm" << 'EOF'
\ Build SSD with tokenized BASIC file and !BOOT
\ Usage: beebasm -i build.asm -do output.ssd -title ROM
\ Files are in tmp directory (current directory when beebasm runs)
\ Use "rommgr" (7 chars max for DFS) as the filename
\ PUTTEXT syntax: PUTTEXT <host filename>, <beeb filename>, <start addr>
\ PUTFILE syntax: PUTFILE <host filename>, [<beeb filename>,] <start addr> [,<exec addr>]
\ Load address &1900 is standard for text files on BBC Micro

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
            # Parse .inf file: format is "$.FILENAME    LOAD   EXEC CRC=XXXX"
            # Extract load and exec addresses (hex, no 0x prefix)
            # Use awk to split by whitespace and get fields 2 (load) and 3 (exec)
            load_addr=$(awk '{print $2}' "$infile" | tr '[:lower:]' '[:upper:]')
            exec_addr=$(awk '{print $3}' "$infile" | tr '[:lower:]' '[:upper:]')
            
            # Validate addresses are hex
            if [[ "$load_addr" =~ ^[0-9A-F]+$ ]] && [[ "$exec_addr" =~ ^[0-9A-F]+$ ]]; then
                # Convert to beebasm format (& prefix for hex)
                load_hex="&$load_addr"
                exec_hex="&$exec_addr"
                
                # Add PUTFILE command to build.asm
                if [ "$load_addr" = "$exec_addr" ]; then
                    # Same load and exec address - only need one parameter
                    echo "PUTFILE \"../bin/$binname\", \"$binname\", $load_hex" >> "$TMP_DIR/build.asm"
                else
                    # Different exec address - include both
                    echo "PUTFILE \"../bin/$binname\", \"$binname\", $load_hex, $exec_hex" >> "$TMP_DIR/build.asm"
                fi
                echo "  Added $binname (load=$load_hex, exec=$exec_hex)"
            else
                echo "  Warning: Could not parse addresses from $infile (load=$load_addr, exec=$exec_addr), skipping $binname"
            fi
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

# Clean up any previous build
rm -f build.ssd

"$PROJECT_ROOT/bin/beebasm" -i "build.asm" -do build.ssd -title ROM 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Failed to build SSD"
    cd - > /dev/null
    exit 1
fi

# Note: All files are added to SSD via beebasm (build.asm) - no need for mmbutils putfile
# build.asm is the control file for what goes in the SSD

# Extract all files from SSD to VDFS directory (emulator sees this)
echo "Extracting files from SSD to VDFS directory..."
cd "$PROJECT_ROOT"

# Clean VDFS directory (only keep what emulator needs)
rm -rf "$VDFS_DIR"/*
mkdir -p "$VDFS_DIR"

# Clean up any previous extractions from project root (mmbutils extracts to current dir)
# Build list of files to clean up dynamically
CLEANUP_FILES="$PROJECT_ROOT/!BOOT $PROJECT_ROOT/rommgr $PROJECT_ROOT/!BOOT.inf $PROJECT_ROOT/rommgr.inf"

# Add binary files from bin directory to cleanup list
if [ -d "$BIN_DIR" ]; then
    for binfile in "$BIN_DIR"/*; do
        [ ! -f "$binfile" ] && continue
        [[ "$(basename "$binfile")" == *.inf ]] && continue
        binname=$(basename "$binfile")
        CLEANUP_FILES="$CLEANUP_FILES $PROJECT_ROOT/$binname $PROJECT_ROOT/$binname.inf"
    done
fi

rm -rf $CLEANUP_FILES 2>/dev/null || true

# Extract !BOOT from SSD (extracts to current directory)
"$PROJECT_ROOT/bin/mmbutils/beeb" getfile "$TMP_DIR/build.ssd" !BOOT > /dev/null 2>&1
if [ $? -eq 0 ]; then
    # mmbutils creates a directory, handle both cases
    if [ -d "!BOOT" ]; then
        mv !BOOT/!BOOT "$VDFS_DIR/!BOOT" 2>/dev/null || true
        if [ -f "!BOOT/!BOOT.inf" ]; then
            mv !BOOT/!BOOT.inf "$VDFS_DIR/!BOOT.inf" 2>/dev/null || true
        fi
        rmdir !BOOT 2>/dev/null || true
    elif [ -f "!BOOT" ]; then
        mv !BOOT "$VDFS_DIR/!BOOT" 2>/dev/null || true
        if [ -f "!BOOT.inf" ]; then
            mv !BOOT.inf "$VDFS_DIR/!BOOT.inf" 2>/dev/null || true
        fi
    fi
else
    # If !BOOT not in SSD, copy from tmp directory
    cp "$TMP_DIR/!BOOT" "$VDFS_DIR/!BOOT" 2>/dev/null || true
fi

# Extract tokenized BASIC file from SSD (now named "rommgr" directly)
"$PROJECT_ROOT/bin/mmbutils/beeb" getfile "$TMP_DIR/build.ssd" rommgr > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Failed to extract tokenized BASIC file from SSD"
    exit 1
fi

# mmbutils creates a directory structure, move file to correct location
if [ -d "rommgr" ]; then
    mv rommgr/rommgr "$VDFS_DIR/rommgr" 2>/dev/null || true
    if [ -f "rommgr/rommgr.inf" ]; then
        mv rommgr/rommgr.inf "$VDFS_DIR/rommgr.inf" 2>/dev/null || true
    fi
    rmdir rommgr 2>/dev/null || true
elif [ -f "rommgr" ]; then
    # File extracted directly (not in subdirectory)
    mv rommgr "$VDFS_DIR/rommgr" 2>/dev/null || true
    if [ -f "rommgr.inf" ]; then
        mv rommgr.inf "$VDFS_DIR/rommgr.inf" 2>/dev/null || true
    fi
fi

# Extract binary files from SSD (dynamically based on what's in bin directory)
if [ -d "$BIN_DIR" ]; then
    for binfile in "$BIN_DIR"/*; do
        # Skip if not a regular file or if it's a .inf file
        [ ! -f "$binfile" ] && continue
        [[ "$(basename "$binfile")" == *.inf ]] && continue
        
        binname=$(basename "$binfile")
        echo "Extracting $binname from SSD..."
        
        "$PROJECT_ROOT/bin/mmbutils/beeb" getfile "$TMP_DIR/build.ssd" "$binname" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            # mmbutils creates a directory structure, move file to correct location
            if [ -d "$binname" ]; then
                mv "$binname/$binname" "$VDFS_DIR/$binname" 2>/dev/null || true
                if [ -f "$binname/$binname.inf" ]; then
                    mv "$binname/$binname.inf" "$VDFS_DIR/$binname.inf" 2>/dev/null || true
                fi
                rmdir "$binname" 2>/dev/null || true
            elif [ -f "$binname" ]; then
                mv "$binname" "$VDFS_DIR/$binname" 2>/dev/null || true
                if [ -f "$binname.inf" ]; then
                    mv "$binname.inf" "$VDFS_DIR/$binname.inf" 2>/dev/null || true
                fi
            fi
        fi
    done
fi

# Final cleanup of any remaining extraction artifacts in project root
rm -rf $CLEANUP_FILES 2>/dev/null || true

# Create rommanager.inf file for VDFS directory
# This controls boot options for the emulator (OPT=00 = no auto-boot, OPT=03 = auto-boot)
echo "Creating rommanager.inf file..."
echo '$.$ OPT=00 DIR=1 MDATE=D148 MTIME=06380F' > "$VDFS_DIR.inf"

# Verify files are in VDFS directory
echo ""
echo "Files in VDFS directory (ready for emulator):"
ls -la "$VDFS_DIR"
echo ""
echo "Ready to run emulator..."
echo ""

echo "Running b-em emulator..."
echo "NOTE: Emulator will stay open (REM *QUIT) so you can see any errors"
echo ""

# Run emulator (BBC Master, possibly with Tube mode for more RAM)
# -autoboot: Auto-execute !BOOT file
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
