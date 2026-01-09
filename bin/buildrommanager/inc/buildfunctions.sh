#!/bin/bash
# Helper functions for ROM Manager build script

# Function to parse .inf file and add PUTFILE command to build.asm
# Usage: parse_inf_file <infile> <binname>
parse_inf_file() {
    local infile="$1"
    local binname="$2"
    
    # Parse .inf file: format is "$.FILENAME    LOAD   EXEC CRC=XXXX"
    # Extract load and exec addresses (hex, no 0x prefix)
    # Use awk to split by whitespace and get fields 2 (load) and 3 (exec)
    local load_addr=$(awk '{print $2}' "$infile" | tr '[:lower:]' '[:upper:]')
    local exec_addr=$(awk '{print $3}' "$infile" | tr '[:lower:]' '[:upper:]')
    
    # Validate addresses are hex
    if [[ "$load_addr" =~ ^[0-9A-F]+$ ]] && [[ "$exec_addr" =~ ^[0-9A-F]+$ ]]; then
        # Convert to beebasm format (& prefix for hex)
        local load_hex="&$load_addr"
        local exec_hex="&$exec_addr"
        
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
}

# Function to extract all files from SSD to VDFS directory
# mmbutils getfile is designed to extract ALL files from an SSD to a destination directory
# Syntax: beeb getfile filename.ssd destdir
# The destdir parameter is just the directory name where all files will be extracted
# Note: Files are left in /tmp for debugging - they will be cleaned on next build run
extract_all_from_ssd() {
    local extract_dir="extracted"
    
    # Extract all files from SSD to extracted/ directory
    # Note: getfile always extracts ALL files - the directory name is arbitrary
    # If directory already exists, getfile will fail, so remove it first
    rm -rf "$extract_dir" 2>/dev/null || true
    
    "$PROJECT_ROOT/bin/mmbutils/beeb" getfile "build.ssd" "$extract_dir" > /dev/null 2>&1
    if [ $? -eq 0 ] && [ -d "$extract_dir" ]; then
        # mmbutils created extraction directory with all files - copy them all to VDFS
        # Use copy instead of move so files remain in /tmp for debugging
        for file in "$extract_dir"/*; do
            if [ -f "$file" ]; then
                local basename_file=$(basename "$file")
                cp "$file" "$VDFS_DIR/$basename_file" 2>/dev/null || true
            fi
        done
        # Leave extracted directory in /tmp for debugging (cleaned on next build run)
    else
        echo "Error: Failed to extract files from SSD"
        exit 1
    fi
}
