\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Configure Module - Master Include File
\ Includes Time-Config source files in correct order
\\
\ Structure:
\ - Original Time-Config files: src/configure/*.asm (untouched)
\ - Compatibility/Abstraction layers: src/configure/inc/*.asm
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\ Include files in dependency order:
\ 1. Constants - Compatibility constants (replaces Header.asm constants)
\ 2. Settings - NVRAM addresses and constants (original)
\ 3. Strings - String utilities (original)
\ 4. Commands - Command parsing infrastructure (original)
\ 5. Configure - CONFIGURE and STATUS commands (original)
\ 6. Roms - INSERT, UNPLUG, ROMS commands (original)
\ 7. NVRAM - NVRAM abstraction layer (compatibility, replaces VIA.asm)

\ Compatibility/Abstraction layers (must come first)
INCLUDE "src/configure/inc/Constants.asm"
INCLUDE "src/configure/inc/Stubs.asm"

\ Original Time-Config files (untouched)
INCLUDE "src/configure/Settings.asm"
INCLUDE "src/configure/Strings.asm"
INCLUDE "src/configure/Commands.asm"
INCLUDE "src/configure/Configure.asm"
INCLUDE "src/configure/Roms.asm"

\ Compatibility/Abstraction layers (after originals)
INCLUDE "src/configure/inc/NVRAM.asm"

