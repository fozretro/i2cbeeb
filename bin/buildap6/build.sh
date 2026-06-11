#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Configuration file for SMJoin (layout selected via AP6_SMJOIN_LAYOUT)
SMJOIN_CONFIG="bin/buildap6/config/smjoin-create-config.js"
AP6_LAYOUT="i2c"
OUTPUT_ROM="dist/ap6.rom"

# Parse command line arguments
SKIP_I2C_BUILD=false
KEEP_SERVER_RUNNING=false
TEST_FILTER=""
VERBOSE=false
SKIP_TESTING=false
SKIP_EMULATOR_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-i2c-build)
            SKIP_I2C_BUILD=true
            shift
            ;;
        --nokill-romserver)
            KEEP_SERVER_RUNNING=true
            shift
            ;;
        --testFilter)
            TEST_FILTER="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --skip-testing)
            SKIP_TESTING=true
            shift
            ;;
        --skip-emulator-tests)
            SKIP_EMULATOR_TESTS=true
            shift
            ;;
        --layout)
            AP6_LAYOUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--layout i2c|classic] [--skip-i2c-build] [--nokill-romserver] [--testFilter ROM1,ROM2,...] [--verbose] [--skip-testing] [--skip-emulator-tests]"
            echo "  --layout i2c|classic  SMJoin ROM list: i2c (default, I²C replaces TreeCopy) or"
            echo "                         classic (TreeCopy, no I²C → dist/ap6-classic.rom)"
            echo "  --skip-i2c-build       Skip I2C ROM compilation, use existing files (i2c layout only)"
            echo "  --nokill-romserver     Keep ROM server running after tests complete"
            echo "  --testFilter           Comma-separated list of ROM names to test (e.g., AP6.rom,I2C.rom)"
            echo "                         Available ROMs: AP6.rom, LatestAP6.rom, I2C.rom, LatestI2C.rom"
            echo "  --verbose, -v          Enable verbose logging in test output"
            echo "  --skip-testing         Skip all ROM tests (Vitest composite and emulator smoke)"
            echo "  --skip-emulator-tests  Skip Playwright/OCR smjoin-test.js (Step 4b); Vitest composite still runs"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

case "$AP6_LAYOUT" in
    i2c)
        OUTPUT_ROM="dist/ap6.rom"
        ;;
    classic)
        OUTPUT_ROM="dist/ap6-classic.rom"
        ;;
    *)
        echo "❌ Unknown --layout '$AP6_LAYOUT' (use i2c or classic)"
        exit 1
        ;;
esac

export AP6_SMJOIN_LAYOUT="$AP6_LAYOUT"

echo "🚀 Build Node.js Tools"
echo "============================="
pushd ./bin/buildap6
npm install
popd

echo "🚀 AP6 Complete Build Pipeline"
echo "============================="
echo "  -> Layout: $AP6_LAYOUT ($OUTPUT_ROM)"
if [ "$AP6_LAYOUT" = "classic" ]; then
    echo "  -> Classic AP6 (TreeCopy, no I²C pre-build)"
fi
if [ "$SKIP_I2C_BUILD" = true ]; then
    echo "  -> Skipping I2C build (using existing files)"
fi
if [ "$SKIP_TESTING" = true ]; then
    echo "  -> Skipping testing step"
fi
if [ "$SKIP_EMULATOR_TESTS" = true ]; then
    echo "  -> Skipping emulator OCR smoke tests (smjoin-test.js)"
fi
echo ""

if [ "$AP6_LAYOUT" = "i2c" ]; then
    # Clear tmp folder when not skipping I2C build
    if [ "$SKIP_I2C_BUILD" = false ]; then
        echo "🧹 Clearing temporary build files..."
        rm -rf bin/buildap6/tmp/*
        echo "✅ Temporary files cleared"
        echo ""
    fi

    if [ "$SKIP_I2C_BUILD" = false ]; then
        echo "📦 Step 1: Building I2C EAP6 Join ROM..."
        ./bin/buildap6/smjoin-build-i2c-rom.sh
        if [ $? -ne 0 ]; then
            echo "❌ I2C EAP6 Join build failed!"
            exit 1
        fi
        echo "✅ I2C EAP6 Join build completed successfully"
    else
        echo "📦 Step 1: Skipping I2C EAP6 Join ROM build..."
        if [ ! -f "./bin/buildap6/tmp/i2c-8000.rom" ] || [ ! -f "./bin/buildap6/tmp/i2c-8100.rom" ]; then
            echo "❌ Required I2C ROM files not found. Run without --skip-i2c-build first."
            exit 1
        fi
        echo "✅ Using existing I2C ROM files"
    fi
    echo ""

    echo "🔗 Step 2: Creating relocation ROM..."
    pushd bin/buildap6 > /dev/null

    # Remove existing i2c-reloc.rom if it exists
    if [ -f "tmp/i2c-reloc.rom" ]; then
        echo "🧹 Removing existing i2c-reloc.rom..."
        rm -f tmp/i2c-reloc.rom
        echo "✅ Existing i2c-reloc.rom removed"
    fi

    node smjoin-reloc.js tmp/8000/I2CEAP6 tmp/8100/I2CEAP6 tmp/i2c-reloc.rom
    popd > /dev/null
    if [ $? -ne 0 ]; then
        echo "❌ Relocation ROM creation failed!"
        exit 1
    fi
    echo "✅ Relocation ROM created successfully"
    echo ""
else
    echo "📦 Steps 1–2: Skipped (classic layout — no I²C relocation)"
    if [ ! -f "roms/TreeROM-v1.62.rom" ] && [ ! -f "roms/TreeCopy-v1.61.rom" ]; then
        echo "❌ No TreeCopy ROM found (roms/TreeROM-v1.62.rom or roms/TreeCopy-v1.61.rom)."
        exit 1
    fi
    echo "✅ TreeCopy ROM found"
    echo ""
fi

echo "🔗 Step 3: Combining ROMs with SMJoin..."
# Add bin/buildap6 to PATH so we can run the script directly
export PATH="bin/buildap6:$PATH"
if [ "$VERBOSE" = true ]; then
    pushd bin/buildap6 > /dev/null
    node smjoin-create.js --config config/smjoin-create-config.js --verbose
    popd > /dev/null
else
    pushd bin/buildap6 > /dev/null
    node smjoin-create.js --config config/smjoin-create-config.js
    popd > /dev/null
fi
if [ $? -ne 0 ]; then
    echo "❌ SMJoin combination failed!"
    exit 1
fi
echo "✅ SMJoin combination completed successfully"
echo ""

echo "📊 Final ROM Statistics:"
if [ -f "$OUTPUT_ROM" ]; then
    ls -la "$OUTPUT_ROM"
    echo "✅ Build completed successfully!"
    
    # Copy ROM and create INF file for /dev/eap6
    echo ""
    echo "📋 Step 5: Copying ROM to /dev/eap6..."
    EAP6_DIR="dev/eap6"
    if [ "$AP6_LAYOUT" = "classic" ]; then
        ROM_NAME="AP6-classic"
    else
        ROM_NAME="AP6"
    fi
    
    # Copy ROM file
    cp "$OUTPUT_ROM" "$EAP6_DIR/$ROM_NAME"
    if [ $? -eq 0 ]; then
        echo "✅ ROM copied to $EAP6_DIR/$ROM_NAME"
        
        # Calculate CRC and create INF file
        python3 << PYEOF
import zlib
import sys

def calc_crc(data):
    """Calculate CRC using BBC Micro format (from BeebUtils.pm)"""
    crc = 0
    for byte in data:
        crc ^= (256 * byte)
        for x in range(8):
            crc *= 2
            if crc > 65535:
                crc -= 65535
                crc ^= 0x1020
    return crc & 0xFFFF

# Read the ROM file
rom_file = "$OUTPUT_ROM"
inf_file = "$EAP6_DIR/$ROM_NAME.inf"
rom_name = "$ROM_NAME"

with open(rom_file, 'rb') as f:
    data = f.read()

# Calculate CRC
crc = calc_crc(data)

# Create INF file - ROMs load at 0x8000
load_addr = 0x8000
exec_addr = 0x8000

inf_content = f"\$.{rom_name}    {load_addr:04X}   {exec_addr:04X} CRC={crc:04X}\n"

with open(inf_file, 'w') as f:
    f.write(inf_content)

print(f"✅ Created {inf_file}")
print(f"   Load: 0x{load_addr:04X}, Exec: 0x{exec_addr:04X}, CRC: 0x{crc:04X}")
PYEOF
        if [ $? -eq 0 ]; then
            echo "✅ INF file created successfully"
        else
            echo "⚠️  Warning: Failed to create INF file"
        fi
    else
        echo "⚠️  Warning: Failed to copy ROM to $EAP6_DIR"
    fi
else
    echo "❌ Output ROM not found at $OUTPUT_ROM"
fi
echo ""

if [ "$SKIP_TESTING" = true ]; then
    echo "🧪 Step 4: Skipping ROM tests..."
    echo "✅ Testing step skipped"
else
    if [ "$AP6_LAYOUT" = "i2c" ]; then
        echo "🧪 Step 4a: Running AP6 amalgam Vitest (fixtures/ap6 only)..."
        pushd bin/rom-unittest > /dev/null
        npm install --silent 2>/dev/null || npm install
        npm run test:composite
        if [ $? -ne 0 ]; then
            popd > /dev/null
            echo "❌ Composite ROM unit tests failed!"
            exit 1
        fi
        popd > /dev/null
        echo "✅ Composite Vitest passed"
        echo ""
    else
        echo "🧪 Step 4a: Skipped (classic layout — composite Vitest targets ap6.rom / I²C slice)"
        echo ""
        echo "🧪 Step 4a-classic: Running AP6 classic amalgam Vitest..."
        pushd bin/rom-unittest > /dev/null
        npm install --silent 2>/dev/null || npm install
        npm run test:classic-composite
        if [ $? -ne 0 ]; then
            popd > /dev/null
            echo "❌ Classic composite ROM unit tests failed!"
            exit 1
        fi
        popd > /dev/null
        echo "✅ Classic composite Vitest passed"
        echo ""
    fi

    if [ "$SKIP_EMULATOR_TESTS" = true ]; then
        echo "🧪 Step 4b: Skipping SMJoin browser smoke tests (--skip-emulator-tests)"
        echo "✅ Emulator smoke tests skipped"
    else
    echo "🧪 Step 4b: Running SMJoin browser smoke tests..."
    if [ -n "$TEST_FILTER" ]; then
        echo "  -> Filtering tests to: $TEST_FILTER"
    fi
    if [ "$VERBOSE" = true ]; then
        echo "  -> Verbose logging enabled"
    fi
    if [ "$KEEP_SERVER_RUNNING" = true ]; then
        echo "  -> Server will be kept running after tests complete"
        pushd bin/buildap6 > /dev/null
        if [ -n "$TEST_FILTER" ] && [ "$VERBOSE" = true ]; then
            node smjoin-test.js --nokill-romserver --testFilter "$TEST_FILTER" --verbose
        elif [ -n "$TEST_FILTER" ]; then
            node smjoin-test.js --nokill-romserver --testFilter "$TEST_FILTER"
        elif [ "$VERBOSE" = true ]; then
            node smjoin-test.js --nokill-romserver --verbose
        else
            node smjoin-test.js --nokill-romserver
        fi
        popd > /dev/null
    else
        pushd bin/buildap6 > /dev/null
        if [ -n "$TEST_FILTER" ] && [ "$VERBOSE" = true ]; then
            node smjoin-test.js --testFilter "$TEST_FILTER" --verbose
        elif [ -n "$TEST_FILTER" ]; then
            node smjoin-test.js --testFilter "$TEST_FILTER"
        elif [ "$VERBOSE" = true ]; then
            node smjoin-test.js --verbose
        else
            node smjoin-test.js
        fi
        popd > /dev/null
    fi
    if [ $? -ne 0 ]; then
        echo "❌ ROM tests failed!"
        exit 1
    fi
    fi
fi
echo ""

echo "🎉 AP6 Complete Build Pipeline finished successfully!"
echo "Output: $OUTPUT_ROM"
echo "=================================================="