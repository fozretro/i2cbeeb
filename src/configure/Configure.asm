
.CON_DataTable
.bootIndex
	EQUB 16,	%11101111,	%00010000		\\ BOOT -- read keyboard switches for default
	EQUB 16,	%11101111,	%00000000		\\ NOBOOT
	EQUB 11,	%11000111,	%00100000		\\ CAPS
	EQUB 11,	%11000111,	%00010000		\\ NOCAPS
	EQUB 11,	%11000111,	%00001000		\\ SHCAPS
	EQUB 12,	0,			50				\\ DELAY
.fdriveIndex
	EQUB 11+&80, %11111000,	%00110000		\\ FDRIVE -- read keyboard switches for default
	EQUB 5,		%11110000,	%00001111		\\ FILE
	EQUB 14,	0,			&0				\\ IGNORE
	EQUB 5,		%00001111,	%11110000		\\ LANG
	EQUB 16,	%11111101,	%00000010		\\ LOUD
	EQUB 16,	%11111101,	%00000000		\\ QUIET
.modeIndex
	EQUB 10+&80, %11111000,	%00000111		\\ MODE -- read keyboard switches for default         
	EQUB 15,	%11111110,	%00000001		\\ TUBE
	EQUB 15,	%11111110,	%00000000		\\ NOTUBE
	EQUB 13,	0,			8				\\ REPEAT
	EQUB 0:		EQUW CON_FS-1				\\ FS
	EQUB 0:		EQUW CON_PS-1				\\ PS

.*CON_Configure
	LDX #configTable - commandTable		\\ start searching for config term
	JSR CMD_matchCommand
	BEQ blankConfig						\\ no config term
	BPL passConfig						\\ unrecognised config term
	STY TempSpace						\\ save character pos
	STA TempSpace+3						\\ save parameter description
	LDA TempSpace+1						\\ load command index
	ASL A
	ADC TempSpace+1
	STA TempSpace+1						\\ multiply index by 3
	TAY
	LDX CON_DataTable,Y					\\ NVRAM address
	BEQ specialConfig					\\ jump to individual routine
	LDA TempSpace+3						\\ load parameter type
	CMP #helpAlt - helpBase
	BCC paramConfig						\\ config term with numeric parameter
.simpleConfig
	CLC
	JSR FRAM_readByte					\\ read NVRAM from address at X = configDataTable,Y
	TYA
	LDY TempSpace+1
	AND CON_DataTable+1,Y				\\ NVRAM mask relevant bits
	ORA CON_DataTable+2,Y				\\ setting
	TAY
	JSR FRAM_writeByte					\\ save new value
	LDA #0
	RTS
.blankConfig
	TYA
	PHA									\\ save character position
	LDX #configTable - commandTable
	JSR CMD_Help						\\ list all config terms + help text
	PLA
	TAY
.passConfig
	LDA #&28							\\ let the rest of the ROMs try
	RTS
.defaultConfig	
	TXA									\\ configDataTable,index
	BPL simpleConfig					\\ dont use keyboard switches
	JSR CON_ReadKeySwitches
	LDY TempSpace+1						\\ command index
	AND CON_DataTable+2,Y				\\ mask out unwanted bits
	STA TempSpace+2						\\ save it
	LDA CON_DataTable+2,Y				\\ load mask
.keyshiftLoop
	LSR A
	BCS doParam1
	LSR TempSpace+2
	BCC keyshiftLoop					\\ always
.specialConfig
	SEC
.^specialStatus
	LDA CON_DataTable+2,Y				\\ address high
	PHA
	LDA CON_DataTable+1,Y				\\ address low
	PHA
	RTS
.paramConfig
	LDY TempSpace						\\ get character pos
	JSR STR_ParseNum					\\ read numeric parameter
	BCS doParam							\\ numeric parameter in A
	BEQ defaultConfig					\\ no parameter, so use default
	BNE badParam
.doParam
	STA TempSpace+2					\\ save it
.doParam1
	LDY TempSpace+1					\\ command index
	LDA CON_DataTable+1,Y				\\ load mask
.shiftLoop
	LSR A
	BCC shiftLoopEnd
	ASL TempSpace+2
	BCC shiftLoop
	BCS badParam
.shiftLoopEnd
	LDA CON_DataTable+1,Y				\\ reload mask
	AND TempSpace+2					\\ check data size
	BNE badParam
	LDA CON_DataTable,Y
	AND #&7F
	TAX
	CLC
	JSR FRAM_readByte					\\ read NVRAM from address at X = configDataTable,Y
	TYA
	LDY TempSpace+1
	AND CON_DataTable+1,Y				\\ NVRAM mask relevant bits
	ORA TempSpace+2					\\ set value
	TAY
	JSR FRAM_writeByte					\\ save new value
	LDA #0
	RTS
.^badParam
	LDX TempSpace+3						\\ load parameter type
	JSR CMD_doError
	EQUS 252, "Bad parameter, expecting ", 0

.CON_Status
{
	LDX #configTable - commandTable		\\ start searching for config term
	JSR CMD_matchCommand
	BEQ blankStatus						\\ no config term
	BPL passStatus						\\ unrecognised config term
	STA TempSpace+3						\\ save parameter description
	LDA TempSpace+1						\\ load command index
	ASL A
	ADC TempSpace+1						\\ multiply index by 3
	TAY
.termStatus
	STY TempSpace+1
	LDA CON_DataTable,Y					\\ NVRAM address
	AND #&7F
	TAX
	CLC
	BEQ specialStatus					\\ jump to individual routine
	JSR FRAM_readByte					\\ read NVRAM from address at X = configDataTable,Y
	TYA									\\ result
	LDY TempSpace+1						\\ index * 3
	ORA CON_DataTable+1,Y				\\ NVRAM mask relevant bits
	EOR CON_DataTable+1,Y				\\ NVRAM flip irrelevant bits
	STA TempSpace						\\ relevant bits from NVRAM
	LDX TempSpace+2						\\ start of this term
	LDA TempSpace+3						\\ load parameter type
	CMP #helpAlt - helpBase
	BCC paramStatus						\\ config term with numeric parameter
.checkNext
	LDA TempSpace						\\ load setting value
	CMP CON_DataTable+2,Y				\\ check setting
	BNE notThisOne
	JSR CMD_printTerm
	JMP endLine
.notThisOne
	LDA TempSpace+3						\\ load parameter type
	CMP #helpAlt - helpBase				\\ check for alternative
	PHP
.skipLoop
	INX
	LDA commandTable-1,X
	BPL	skipLoop						\\ skip over term
	STA TempSpace+3
	PLP
	BNE nothing							\\ no alternative matches setting
	INY
	INY
	INY									\\ next index
	BNE checkNext						\\ always true
.paramStatus
	JSR CMD_printTerm
	LDA CON_DataTable+1,Y
.shiftLoop
	LSR A
	BCC shifted
	LSR TempSpace						\\ convert data bits to number
	BCC shiftLoop						\\ should be always true
.^shifted
	LDA #' '
	JSR OSWRCH
	LDA TempSpace						\\ numeric parameter value
	STY TempSpace+1
	JSR STR_PrintNum
	LDY TempSpace+1
.^endLine
	JSR OSNEWL
.nothing
	LDA #0
	RTS
.notFSPS
	PLA
	TAY
.passStatus
	LDA #&29							\\ let the rest of the ROMs try
	RTS

.blankStatus
	TYA
	PHA									\\ save character position
	LDX #configTable - commandTable
	LDY #0
.termLoop1
	STX TempSpace+2						\\ start of term
.termLoop
	INX
	LDA commandTable-1,X
	BEQ termDone
	BPL termLoop
	STA TempSpace+3
	JSR termStatus						\\ print term & status
	INY
	INY
	INY
	BNE termLoop1						\\ always
.termDone
	CPX #fspsTable-commandTable
	BNE notFSPS
	LDX OS_ROMNum
	LDA OS_RomBytes,X
	AND #&40
	BEQ notFSPS
	LDX #fspsTable-commandTable
	BNE termLoop1						\\ always
}

.CON_ReadKeySwitches
{
	LDA #8					\\ AP6: no dips; bit 3 set => SET_Reset leaves NOBOOT
	RTS
}

.CON_FSPS
{
	LDY TempSpace					\\ get character pos
	JSR STR_ParseDec				\\ read numeric parameter
	BCS doNetwork
	BNE badParam2
	LDA #0							\\ default network 0
	STA TempSpace+1
	BEQ defaultFS
.doNetwork
	STA TempSpace+1
	JSR GSREAD
	BCC dot
	LDA TempSpace+1					\\ no dot, so last value was server ID
	LDX #0
	STX TempSpace+1					\\ default network 0
	BCS writeFS
.dot
	CMP #'.'						\\ check for full stop
	BNE badParam2
	JSR STR_ParseDec				\\ read numeric parameter
	BCS writeFS
	BNE badParam2
.defaultFS
	CLC								\\ use default ID
.writeFS
	RTS
.badParam2
	JMP badParam
}

.CON_FS
{
	BCC fsStatus
	JSR CON_FSPS
	BCS notDefault
	LDA #&FE						\\ default file server ID 254
.notDefault
	TAY
	CLC
	LDX #NVR_EconetServer
	JSR FRAM_writeByte
	LDX #NVR_EconetServerNet
	LDY TempSpace+1
	JSR FRAM_writeByte
	LDA #0
	RTS

.fsStatus
	LDX #NVR_EconetServer
	CLC
	JSR FRAM_readByte				\\ read NVRAM from address 1
	STY TempSpace
	LDX #NVR_EconetServerNet
.^fspsStatus
	JSR FRAM_readByte
	TYA
	PHA
	LDX TempSpace+2					\\ start of this term
	JSR CMD_printTerm
	LDA #' '
	JSR OSWRCH
	PLA
	JSR STR_PrintNum
	LDA #'.'
	JSR OSWRCH
	LDA TempSpace
	JSR STR_PrintNum
	LDY TempSpace+1
	JMP endLine
}

.CON_PS
{
	BCC psStatus
	JSR CON_FSPS
	BCS notDefault
	LDA #&EB						\\ default print server ID 235
.notDefault
	TAY
	CLC
	LDX #NVR_EconetPrint
	JSR FRAM_writeByte
	LDX #NVR_EconetPrintNet
	LDY TempSpace+1
	JSR FRAM_writeByte
	LDA #0
	RTS
	
.psStatus
	LDX #NVR_EconetPrint
	CLC
	JSR FRAM_readByte				\\ read NVRAM from address 3
	STY TempSpace
	LDX #NVR_EconetPrintNet
	JMP fspsStatus
}

