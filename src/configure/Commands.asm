
\ timestr* time-format strings and the TIME/TIMEZONE/SUMMERTIME help strings
\ (helpTime/helpTimeZone/helpDST) were removed: those commands were stripped
\ during extraction, so nothing references them. The help strings below are
\ addressed as single-byte offsets from helpBase (anchored to the end of the
\ pool), so dropping earlier entries does not move the live offsets.
.helpConf
	EQUS "(<config>)",0
.helpRom
	EQUS "<0-F>",0
.help7
	EQUS "<0-7>",0
.help8
	EQUS "<0-8>",0
.help255
	EQUS "<0-255>",0
.helpTV
	EQUS "<252-3>(,<0-1>)",0
.helpSid
	EQUS "(<0-255>.)<0-255>",0
.helpAlt
	EQUS " /",0								\\ must be last

helpBase = P% - &100
IF helpConf < helpBase					\\ help string pool must fit the &100-byte helpBase window
   ERROR "Table too large"
ENDIF

.commandTable
	EQUS "CONFIGURE", helpConf - helpBase
	EQUS "STATUS", helpConf - helpBase
	\ UNPLUG/INSERT/ROMS removed - handled by the ROM Manager ROM, not the
	\ configure module (see src/configure/inc/Configure.inc). Roms.asm dropped.
	EQUB 0

.configTable
	EQUS "BOOT", helpAlt - helpBase
	EQUS "NOBOOT", &FF
	EQUS "CAPS", helpAlt - helpBase
	EQUS "NOCAPS", helpAlt - helpBase
	EQUS "SHCAPS", &FF
	EQUS "DELAY", help255 - helpBase
	EQUS "FDRIVE", help7 - helpBase
	EQUS "FILE", helpRom - helpBase
	EQUS "LANG", helpRom - helpBase
	EQUS "MODE", help7 - helpBase
	EQUS "TUBE", helpAlt - helpBase
	EQUS "NOTUBE", &FF
	EQUS "REPEAT", help255 - helpBase
	EQUB 0
.fspsTable
	EQUS "FS", helpSid - helpBase
	EQUS "PS", helpSid - helpBase
	EQUB 0

IF P% - commandTable > &FF
	ERROR "Table too large"
ENDIF

\ Command routing removed: CMD_Command/cmdJmpTable and the standalone
\ CMD_Configure/CMD_Status service-call handlers are unused here - I2CBeeb
\ dispatches via its own command table to CON_Configure/CON_Status
\ (Configure.asm). The data tables above and CMD_matchCommand / CMD_Help /
\ CMD_printTerm / CMD_doError below remain in use by Configure.asm.

.CMD_printTerm
{
	LDA #' '
	JSR OSWRCH
.printLoop
	JSR OSWRCH
	INX
	LDA commandTable-1,X
	BPL printLoop
	RTS
}

.CMD_Help							\\ List all commands from commandTable,X, with corresponding helpBase strings
{
	JSR CMD_printTerm
	CMP #&FF
	BEQ noHelpParam
.helpParam
	TAY
	LDA #' '
.paramLoop
	JSR OSWRCH
	INY
	BEQ CMD_Help
	LDA helpBase-1,Y
	BNE paramLoop
.noHelpParam
	JSR OSNEWL
	LDA commandTable,X
	BNE CMD_Help
	CPX #fspsTable-commandTable-1
	BNE notFSPS
	LDX OS_ROMNum
	LDA OS_RomBytes,X
	AND #&40
	BEQ notFSPS
	LDX #fspsTable-commandTable
	BNE CMD_Help
.notFSPS
	RTS
}


.CMD_matchCommand					\\ Search for the word at (TextPointer),Y from commandTable,X
									\\ return with A = CommandTable,X & TempSpace+1 = index for match, TempSpace+2 = start of matched term, N set for match
									\\ N clear & A = 4 for no match, Z set for blank
{
	LDA #0
	STA TempSpace+1				\\ save table index
	CLC
	JSR GSINIT
	BEQ blankCommand
	STY TempSpace					\\ save start of word
.wordLoop
	STX TempSpace+2
.matchLoop
	JSR GSREAD						\\ next character
	BCS endWord						\\ end of word
	CMP #'.'
	BEQ abbrev						\\ abbreviation
	EOR commandTable,X
	AND #LO(NOT(&20))				\\ capitalise
	BNE notMatch
	INX
	BNE matchLoop
.endWord
	LDA commandTable,X				\\ check for end of word in table
	BPL skipLoop2					\\ no match
	RTS								\\ match
.skipLoop
	INX	
.abbrev
	LDA commandTable,X				\\ check for end of word in table
	BPL skipLoop					\\ skip over unabbreviated word
	RTS
.skipLoop2
	INX	
.notMatch
	LDA commandTable,X
	BPL	skipLoop2					\\ skip over unmatched word
	INC TempSpace+1					\\ increment table index
	LDY TempSpace					\\ go back to start of word
	INX								\\ next word in table
	LDA commandTable,X				\\ check for table end
	BNE wordLoop
	CPX #fspsTable-commandTable-1
	BNE notFSPS
	LDX OS_ROMNum
	LDA OS_RomBytes,X
	AND #&40
	BEQ notFSPS
	LDX #fspsTable-commandTable
	BNE wordLoop
.notFSPS
	LDA #4
.blankCommand
	RTS
}

.CMD_doError
{
	PLA
	STA ErrorPtr
	PLA
	STA ErrorPtr+1
	LDA #0								\\ opcode for BRK
	TAY
.errorLoop
	STA &0100,Y
	INY
	LDA (ErrorPtr),Y
	BNE errorLoop
.errorLoop2
	LDA helpBase,X
	STA &0100,Y
	INY
	INX
	CMP #0
	BNE errorLoop2
	JMP &0100
}
