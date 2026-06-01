\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Constants Compatibility Layer
\ Defines constants expected by Time-Config files
\ (from Header.asm, but without ROM header)
\ Only defines constants that Time-Config needs but I2CBeeb.asm doesn't have
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\ System constants (from Time-Config Header.asm)
\ Note: OSASCI, OSWRCH, OSNEWL, OSBYTE, OSW_X, OSW_Y, cli are already defined in I2CBeeb.asm
\ Define aliases and additional constants needed by Time-Config

\ Aliases for OSWORD parameters (I2CBeeb uses OSW_X/OSW_Y, Time-Config uses OSBYTEX/OSBYTEY)
OSWORDPtr	= &F0
OSWORDNum	= &EF
\ Note: OSBYTEA, OSBYTEX, OSBYTEY are defined in I2CBeeb.asm when INC_CONFIG is enabled
\ They are aliases: OSBYTEA=OSW_A, OSBYTEX=OSW_X, OSBYTEY=OSW_Y
TextPointer	= cli		\ Alias to existing cli
ReadRomPtr	= &F6
ErrorPtr	= &FD
TempSpace	= &A8		\ A8 - AF MOS star-command scratch (writable by * handlers)
TempSpace2	= &E4		\ E4-E5 string pointer for STR_PrintString (GSINIT/GSREAD use cli and &AA)
OSWORD		= &FFF1
EVENTV		= &220
GSREAD		= &FFC5
GSINIT		= &FFC2
OSRDRM		= &FFB9
OSARGS		= &FFDA
OS_RomTable	= &02A1
OS_RomBytes = &0DF0
OS_ROMNum	= &F4
ROMSEL		= &FE30

\ ROM header symbols (from Header.asm) - stubs for Roms.asm
\ These are referenced by Roms.asm but we'll provide dummy values
\ Note: Roms.asm reads these from ROM header, but we're not including Header.asm
\ For now, provide address values that won't crash (point to safe memory)
ROM_versionBin = &8004	\ ROM header offset 4 (version byte)
ROM_title = &8005		\ ROM header offset 5 (title string)
ROM_version = &8005		\ Same as title (version follows title)
ROM_copyright = &8000	\ Will be calculated from header
ROM_copyrightOffset = 0	\ Offset to copyright (calculated)
codeStart = &8000		\ ROM start address

