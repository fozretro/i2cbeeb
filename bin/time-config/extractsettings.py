#!/usr/bin/env python3
"""
Extract Settings.asm from Time-Config repository with selective removals.

Removes:
- Hard break flag setting (LDX OS_ROMNum, LDA #&80, STA OS_RomBytes,X)
- unplugRoms calls after .notMissing (2 calls with 6 lines total)
- unplugRoms function (entire function)

Preserves upstream .notRKey / .notMissing FRAM detection (Time-Config e29478c+).

Adds closing brace for SET_Startup after removing unplugRoms function.

AP6 factory-reset defaults (SET_Reset / SET_DefaultsTable):
- NVR 0 (Econet station): 1 (no &FE18 jumper read on Electron)
- NVR 10: MODE 6
- NVR 11: FDRIVE 0 (CAPS bits unchanged)
- NVR 16: NOBOOT (%10100010 — boot bit clear; CON_ReadKeySwitches must return &08 on AP6)
"""

import sys
import re


def apply_ap6_reset_patches(lines):
    """Electron AP6 factory defaults for SET_Reset (R-key and blank NVRAM)."""
    out = []
    for line in lines:
        if "address 10: MODE" in line:
            out.append(
                "\tEQUB %00000110\t\t\t\\\\ address 10: MODE & TV (AP6: MODE 6)\n"
            )
            continue
        if "address 11: FDRIVE" in line:
            out.append(
                "\tEQUB %11000000\t\t\t\\\\ address 11: FDRIVE & CAPS (AP6: FDRIVE 0)\n"
            )
            continue
        if "LDY EconetIDreg" in line and "read Econet" in line:
            out.append(
                "\tLDY #1\t\t\t\t\t\t\\\\ AP6: default Econet station 1\n"
            )
            continue
        out.append(line)
    return out


def extract_settings(input_file, output_file):
    """Extract Settings.asm with problematic code removed."""
    with open(input_file, 'r') as f:
        lines = f.readlines()
    
    output_lines = []
    i = 0
    in_unplug_roms = False
    brace_count = 0
    skip_unplug_calls = False
    skip_hard_break = False
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Remove unplugRoms calls (after .notMissing in current Time-Config)
        if stripped == '.notRKey':
            output_lines.append(line)
            i += 1
            continue

        if stripped == '.notMissing':
            output_lines.append(line)
            skip_unplug_calls = True
            i += 1
            continue
        
        if skip_unplug_calls:
            # Skip lines that are part of unplugRoms calls
            if ('NVR_Roms07Status' in line or 
                'NVR_Roms8FStatus' in line or 
                'unplugRoms' in line or
                (stripped == 'LDA #0' and skip_unplug_calls) or
                (stripped == 'LDA #8' and skip_unplug_calls)):
                i += 1
                continue
            
            # If we hit LDA #OSB_BreakType, we're past the unplugRoms calls
            if 'LDA #OSB_BreakType' in line:
                output_lines.append(line)
                skip_unplug_calls = False
                i += 1
                continue
            
            # If we hit something else, stop skipping
            skip_unplug_calls = False
            output_lines.append(line)
            i += 1
            continue
        
        # Remove hard break flag setting (lines 174-176)
        if stripped == '.hardBreak':
            output_lines.append(line)
            skip_hard_break = True
            i += 1
            continue
        
        if skip_hard_break:
            # Skip hard break flag setting lines
            if ('LDX OS_ROMNum' in line or 
                'LDA #&80' in line or 
                ('STA OS_RomBytes,X' in line and 'hard break flag' in line)):
                i += 1
                continue
            
            # If we hit LDX #NVR_VDUSettings, we're past the hard break flag code
            if 'LDX #NVR_VDUSettings' in line:
                output_lines.append(line)
                skip_hard_break = False
                i += 1
                continue
            
            # If we hit something else, stop skipping
            skip_hard_break = False
            output_lines.append(line)
            i += 1
            continue
        
        # Remove unplugRoms function (lines 319-339)
        if stripped == '.unplugRoms':
            in_unplug_roms = True
            brace_count = 0
            # Skip the function definition line
            i += 1
            continue
        
        if in_unplug_roms:
            # Track braces when in unplugRoms function
            if '{' in line:
                brace_count += 1
                i += 1
                continue
            
            if '}' in line:
                brace_count -= 1
                if brace_count == 0:
                    in_unplug_roms = False
                    # After removing unplugRoms, we need to add closing brace for SET_Startup
                    # The unplugRoms function closing brace was also closing SET_Startup
                    # So we add it back here
                    output_lines.append('}\n')
                    i += 1
                    continue
                i += 1
                continue
            
            # Skip all lines inside unplugRoms function
            i += 1
            continue
        
        # After JMP done, check if unplugRoms follows (which we're removing)
        # If so, we need to add closing brace for SET_Startup
        if stripped.endswith('JMP done') or stripped == 'JMP done':
            output_lines.append(line)
            # Look ahead to see if unplugRoms is next
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                next_stripped = next_line.strip()
                if next_stripped == '':
                    # Blank line - check the line after
                    if i + 2 < len(lines):
                        next_next_line = lines[i + 2]
                        next_next_stripped = next_next_line.strip()
                        if next_next_stripped == '.unplugRoms':
                            # unplugRoms is next - add closing brace for SET_Startup
                            output_lines.append(next_line)  # blank line
                            output_lines.append('}\n')
                            # Skip the blank line and unplugRoms (will be handled by unplugRoms handler)
                            i += 2
                            continue
            i += 1
            continue
        
        # Print all other lines
        output_lines.append(line)
        i += 1
    
    output_lines = apply_ap6_reset_patches(output_lines)

    # Write output
    with open(output_file, 'w') as f:
        f.writelines(output_lines)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input_file> <output_file>", file=sys.stderr)
        sys.exit(1)
    
    extract_settings(sys.argv[1], sys.argv[2])
