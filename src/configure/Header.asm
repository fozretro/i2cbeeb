\ System constants
OSWORDPtr	= &F0
OSWORDNum	= &EF
OSBYTEA		= &EF
OSBYTEX		= &F0
OSBYTEY		= &F1
TextPointer	= &F2		\ Command line pointer
ReadRomPtr	= &F6
ErrorPtr	= &FD
TempSpace	= &A8		\ A8 - AF supposed to be usable for OS commands
TempSpace2	= &E4		\ E4 - E6 general purpose, used by GSINIT/GSREAD
OSWORD		= &FFF1
EVENTV		= &220
GSREAD		= &FFC5
GSINIT		= &FFC2
OSRDRM		= &FFB9
OSARGS		= &FFDA
OS_RomTable	= &02A1
OS_RomBytes	= &0DF0
OS_ROMNum	= &F4
ROMSEL		= &FE30

.*notCommand
	CMP	#7
	BNE	notOSBYTE
	LDA	OSBYTEA			\ Check OSBYTE number
	CMP	#&A1
	BNE	notOSBYTEA1
	LDX	OSBYTEX
	CPX	#255
	BNE	osbyte_a1_read
	LDY	OSBYTEY
	CPY	#49
	BNE	osbyte_a1_read
	LDY	#NVRAM_MAX_OFFSET
	LDA	#0
	RTS
.osbyte_a1_read
	CLC
	JSR	FRAM_readByte		\ perform OSBYTE &A1
	LDA	#0
	RTS
.notOSBYTEA1
	CMP	#&A2
	BNE	notOSBYTEA2
	LDX	OSBYTEX
	LDY	OSBYTEY
	CLC
	JSR	FRAM_writeByte		\ perform OSBYTE &A2
	LDA	#0
	RTS
.notOSBYTEA2
	LDA	#7
	RTS
.notOSBYTE
	LDA	#7
	RTS
