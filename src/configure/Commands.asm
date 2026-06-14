
.timestr1
	EQUS "S/A",0
.timestr3
	EQUS "zzz",0
.timestr4
	EQUS "T+tt",0
.timestr6
	EQUS "zzz+hh",0
.timestr7
	EQUS "S+ss.cc",0
.timestr8
	EQUS "hh:mm:ss",0
.timestr9
	EQUS "zzz+hh:mm",0
.timestr15
	EQUS "www,dd mmm yyyy",0
.timestr24
	EQUS "www,dd mmm yyyy.hh:mm:ss",0
	EQUB 0

.helpTime
	EQUS "(<timestr>)",0
.helpTimeZone
	EQUS "zzz=(zzz+/-hh(:mm))",0
.helpDST
	EQUS "<tz1> <tz1end> ..",0
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
IF timestr1 < helpBase OR helpTime - helpBase < &80
   ERROR "Table too large"
ENDIF

.commandTable
	EQUS "CONFIGURE", helpConf - helpBase
	EQUS "STATUS", helpConf - helpBase
	EQUS "UNPLUG", helpRom - helpBase
	EQUS "INSERT", helpRom - helpBase
	EQUS "ROMS", &FF
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
	EQUS "IGNORE", help255 - helpBase
	EQUS "LANG", helpRom - helpBase
	EQUS "LOUD", helpAlt - helpBase
	EQUS "QUIET", &FF
	EQUS "MODE", help7 - helpBase
	EQUS "TUBE", helpAlt - helpBase
	EQUS "NOTUBE", &FF
	EQUS "REPEAT", help255 - helpBase
	EQUB 0
.fspsTable
	EQUS "FS", helpSid - helpBase
	EQUS "PS", helpSid - helpBase
	EQUB 0

.helpTable
	EQUS "T&C",&FF
	EQUB 0
	
IF P% - commandTable > &FF
	ERROR "Table too large"
ENDIF

.cmdJmpTable
	EQUW CMD_Configure-1, CMD_Status-1, CMD_Unplug-1, CMD_Insert-1, CMD_Roms-1


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

.CMD_Command
{
	LDX #0
	JSR CMD_matchCommand
	BPL passCommand					\\ either blank or no match
	LDA TempSpace+1
	ASL A
	TAX
	LDA cmdJmpTable+1,X				\\ address high
	PHA
	LDA cmdJmpTable,X				\\ address low
	PHA
.passCommand
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


.CMD_Configure
{
	LDX #&28
.serviceCall
	CLC
	JSR GSINIT					\\ check for end of line
	PHP							\\ save result
	LDA #143
	JSR OSBYTE					\\ issue service call &28 or &29 to roms
	PLP
	BEQ noParams				\\ if no config term, can't be an error
	TXA							\\ X is zero if some rom dealt with it, NZ otherwise
	BNE error
.noParams
	LDA #0
	RTS
.error
	LDX #&FF
	JSR CMD_doError
	EQUS 254, "Bad configure", 0

.*CMD_Status
	LDX #&29
	BNE serviceCall
}




