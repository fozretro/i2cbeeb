#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

############################################################
# Time-Config Extraction Script
# Clones Time-Config repository and extracts source files
# with selective removal of unwanted features
############################################################

TIMECONFIG_REPO="https://codeberg.org/Barneyntd/Time-Config..git"
TIMECONFIG_DIR="./refs/Time-Config"
CONFIGURE_DIR="./src/configure"

# Anchor to specific commit for reproducible builds
# Update this when you want to use a newer version of Time-Config
# Commit: c8acf228d64423d19735a18bd4e2e59b0c6277a4
# Date: 2025-09-11 13:02:42 +0100
# Message: Fixed config print 4 bug
TIMECONFIG_COMMIT="c8acf228d64423d19735a18bd4e2e59b0c6277a4"

# Clone Time-Config repo if it doesn't exist
if [ ! -d "$TIMECONFIG_DIR/.git" ]; then
    echo ""
    echo "*** Cloning Time-Config repository ***"
    git clone "$TIMECONFIG_REPO" "$TIMECONFIG_DIR" || {
        echo "Error: Failed to clone Time-Config repository"
        echo "Please ensure you have network access and git is installed"
        exit 1
    }
fi

# Checkout the anchored commit to ensure reproducible builds
cd "$TIMECONFIG_DIR" || exit 1

# Fetch latest changes to ensure the commit is available
git fetch origin > /dev/null 2>&1 || true

CURRENT_COMMIT=$(git rev-parse HEAD)
if [ "$CURRENT_COMMIT" != "$TIMECONFIG_COMMIT" ]; then
    echo ""
    echo "*** Checking out Time-Config commit $TIMECONFIG_COMMIT ***"
    git checkout "$TIMECONFIG_COMMIT" || {
        echo "Error: Failed to checkout commit $TIMECONFIG_COMMIT"
        echo "The commit may not exist. Verify the commit hash is correct."
        exit 1
    }
fi
cd - > /dev/null || exit 1

# Create configure directory
mkdir -p "$CONFIGURE_DIR"

# Make existing files writable if they exist (they're read-only)
chmod 644 "$CONFIGURE_DIR/Settings.asm" 2>/dev/null || true
chmod 644 "$CONFIGURE_DIR/Strings.asm" 2>/dev/null || true
chmod 644 "$CONFIGURE_DIR/Roms.asm" 2>/dev/null || true
chmod 644 "$CONFIGURE_DIR/Commands.asm" 2>/dev/null || true
chmod 644 "$CONFIGURE_DIR/Configure.asm" 2>/dev/null || true

# Copy original Time-Config source files (untouched)
echo ""
echo "*** Copying Time-Config source files ***"
cp "$TIMECONFIG_DIR/ROM/Settings.asm" "$CONFIGURE_DIR/"
cp "$TIMECONFIG_DIR/ROM/Strings.asm" "$CONFIGURE_DIR/"
cp "$TIMECONFIG_DIR/ROM/Roms.asm" "$CONFIGURE_DIR/"

# Copy Commands.asm with selective removal of TIME command
echo "*** Extracting Commands.asm (removing TIME command) ***"
awk '
    BEGIN { 
        in_cmd_time = 0
        brace_count = 0
        skip_line = 0
    }
    
    # Track when we enter CMD_Time routine
    /^\.CMD_Time$/ {
        in_cmd_time = 1
        brace_count = 0
        skip_line = 1
        next
    }
    
    # Track braces when in CMD_Time routine
    in_cmd_time {
        if (/\{/) {
            brace_count++
            skip_line = 1
            next
        }
        if (/\}/) {
            brace_count--
            if (brace_count == 0) {
                in_cmd_time = 0
                skip_line = 1
                next
            }
            skip_line = 1
            next
        }
        skip_line = 1
        next
    }
    
    # Remove "TIME" entry from commandTable (must be on its own line)
    /^[[:space:]]*EQUS[[:space:]]+"TIME",/ {
        next
    }
    
    # Remove "TIME" entry from helpTable
    /^[[:space:]]*EQUS[[:space:]]+"TIME"/ && /helpTable/ {
        next
    }
    
    # Remove TIMEZONE and SUMMERTIME from configTable
    /^[[:space:]]*EQUS[[:space:]]+"TIMEZONE"/ {
        next
    }
    /^[[:space:]]*EQUS[[:space:]]+"SUMMERTIME"/ {
        next
    }
    
    # Remove CMD_Time-1 from cmdJmpTable line
    /EQUW.*CMD_Time-1/ {
        gsub(/[[:space:]]*CMD_Time-1,[[:space:]]*/, " ")
        # If line is now empty or just whitespace, skip it
        if ($0 ~ /^[[:space:]]*$/) next
    }
    
    # Print all other lines
    { print }
' "$TIMECONFIG_DIR/ROM/Commands.asm" > "$CONFIGURE_DIR/Commands.asm"

# Copy Configure.asm with selective removal of TIMEZONE and SUMMERTIME jump table entries
echo "*** Extracting Configure.asm (removing TIMEZONE/SUMMERTIME) ***"
awk '
    # Remove CON_Timezone-1 and CON_DST-1 from jump table (lines 26-27)
    # These are on lines like: EQUB 0: EQUW CON_Timezone-1 \ TIMEZONE
    /EQUW.*CON_Timezone-1/ {
        next
    }
    /EQUW.*CON_DST-1/ {
        next
    }
    
    # Print all other lines
    { print }
' "$TIMECONFIG_DIR/ROM/Configure.asm" > "$CONFIGURE_DIR/Configure.asm"

# Make extracted files read-only to prevent accidental modifications
echo "*** Making extracted files read-only ***"
chmod 444 "$CONFIGURE_DIR/Settings.asm"
chmod 444 "$CONFIGURE_DIR/Strings.asm"
chmod 444 "$CONFIGURE_DIR/Commands.asm"
chmod 444 "$CONFIGURE_DIR/Configure.asm"
chmod 444 "$CONFIGURE_DIR/Roms.asm"

echo "*** Time-Config extraction complete ***"

# Note: Header.asm and VIA.asm are NOT copied as they are replaced by:
# - Header.asm: Service calls integrated into I2CBeeb.asm
# - VIA.asm: Replaced by src/configure/inc/NVRAM.asm (I2C EEPROM abstraction)

