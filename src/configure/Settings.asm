EconetIDreg			= &FE18
KeyCodeR			= &B3
ScreenInit			= &C300

OSB_KbdScan			= &79
OSB_KbdScanAll		= &7A
OSB_WrCurKeys		= &78
OSB_KeyRptDelay		= &0B
OSB_KeyRtpRate		= &0C
OSB_CapsSetting		= &CA
OSB_CapsLEDs		= &76
OSB_BellVolume		= &D4
OSB_TVAdjust		= &90
OSB_LanguageRom		= &FC
OSB_EnterLanguage	= &8E
OSB_BASICRom		= &BB
OSB_RXBaudRate		= &07
OSB_TXBaudRate		= &08
OSB_PrinterDest		= &05
OSB_PrinterIgnore	= &06
OSB_TubePresence	= &EA
OSB_SerialFormat	= &9C
OSB_BreakType		= &FD
OSB_KbdStartOpt		= &FF

OSW_NetStationInfo	= &13

NVR_EconetStation	= 0
NVR_EconetServer	= 1
NVR_EconetServerNet	= 2
NVR_EconetPrint		= 3
NVR_EconetPrintNet	= 4
NVR_DefaultRoms		= 5
NVR_Roms07Status	= 6
NVR_Roms8FStatus	= 7
NVR_VDUSettings		= 10
NVR_CapsFDSettings	= 11
NVR_KeyRptDelay		= 12
NVR_KeyRptRate		= 13
NVR_PrinterIgnore	= 14
NVR_TubeSerialPrint	= 15
NVR_BellBSFormat	= 16
NVR_InitMarker		= 17			\\ AP6: initialised flag (PCF8583 reg 23h)

.SET_DefaultsTable
	EQUB &FE				\\ address 1: FS station
	EQUB 0					\\ address 2: FS network
	EQUB &EB				\\ address 3: PS station
	EQUB 0					\\ address 4: PS network
	EQUB %11111111			\\ address 5: FILE & LANG
	EQUB %11111111			\\ address 6: ROM 0-7
	EQUB %11111111			\\ address 7: ROM 8-F
	EQUB 0					\\ address 8: EDIT settings
	EQUB 0					\\ address 9: Telecom settings
	EQUB %00000110			\\ address 10: MODE & TV (AP6: MODE 6)
	EQUB %11000000			\\ address 11: FDRIVE & CAPS (AP6: FDRIVE 0)
	EQUB 50					\\ address 12: DELAY
	EQUB 8					\\ address 13: REPEAT
	EQUB 10					\\ address 14: IGNORE
	EQUB %00111011			\\ address 15: TUBE, BAUD & PRINT
	EQUB %10100010			\\ address 16: LOUD, BOOT & DATA
\\	EQUB 0					\\ address 17: ANFS settings

SET_Defaults = P% - 17

.SET_Reset
{
	LDX #SET_DefaultsTable - SET_Defaults
	CLC
.resetLoop
	LDY SET_Defaults,X
	JSR FRAM_writeByte
	INX
	CPX #17
	BCC resetLoop
	LDY #1						\\ AP6: default Econet station 1
	LDX #0
	CLC
	JSR FRAM_writeByte					\\ save in NVRAM 0
	LDY #&FF
	LDX #NVR_InitMarker
	CLC
	JSR FRAM_writeByte					\\ ensure *FX 161,17 returns 255
	JSR CON_ReadKeySwitches
	TAX
	AND #%00001000
	EOR #%00001000
	ASL A
	STA TempSpace						\\ save BOOT setting
	TXA
	AND #%00110000						\\ extract FDRIVE setting
	LSR A
	LSR A
	LSR A
	LSR A
	STA TempSpace+1						\\ save FDRIVE setting
	TXA
	AND #%00000111						\\ extract MODE setting
	STA TempSpace+2						\\ save MODE setting
	LDX #NVR_BellBSFormat
	CLC
	JSR FRAM_readByte
	TYA
	ORA TempSpace
	TAY
	JSR FRAM_writeByte
	LDX #NVR_CapsFDSettings
	CLC
	JSR FRAM_readByte
	TYA
	ORA TempSpace+1
	TAY
	JSR FRAM_writeByte
	LDX #NVR_VDUSettings
	CLC
	JSR FRAM_readByte
	TYA
	ORA TempSpace+2
	TAY
	JSR FRAM_writeByte
	RTS
}


\*******************************************************\
\														\
\				Service call 01: startup				\
\														\
\*******************************************************\

.SET_Startup
{
	TYA
	PHA
	LDX #NVR_InitMarker
	CLC
	JSR FRAM_readByte		\\ check for blank NVRAM
	TYA
	BEQ resetEverything
	LDX #KeyCodeR
	LDA #OSB_KbdScan
	JSR OSBYTE				\\ check for R key pressed
	TXA
	BPL notRKey
	LDA #OSB_WrCurKeys
	JSR OSBYTE				\\ write current keys pressed info
	JMP resetSettings
.notRKey
	LDX #NVR_EconetServer	\\ this should never be 255
	CLC
	JSR FRAM_readByte		\\ check for nonexistant NVRAM
	CPY #255
	BNE notMissing
	LDY OS_ROMNum
	LDA #0
	STA OS_RomTable,Y
	JMP done
.notMissing

	LDA #OSB_BreakType
	LDX #0
	LDY #&FF
	JSR OSBYTE				\\ look up break type
	TXA
	BNE hardBreak
.done
	PLA
	TAY
	LDA #1
	RTS
.resetEverything
	JSR RTC_resetClock		\\ reset clock chip & variables
	JSR RTC_resetTZN		\\ reset timezone names
	JSR DST_reset			\\ reset summertime
.resetSettings
	JSR SET_Reset
.hardBreak
	LDX #NVR_VDUSettings
	CLC
	JSR FRAM_readByte
	TYA
	AND #7
	STA TempSpace
	LDX #NVR_BellBSFormat
	CLC
	JSR FRAM_readByte
	TYA
	AND #%00010000
	EOR #%00010000
	LSR A
	ORA TempSpace
	STA TempSpace
	LDX #NVR_CapsFDSettings
	CLC
	JSR FRAM_readByte
	TYA
	AND #3
	ASL A
	ASL A
	ASL A
	ASL A
	ORA TempSpace
	STA TempSpace
	TAX
	LDY #%11000000
	LDA #OSB_KbdStartOpt		\\ change keyboard startup byte to match settings
	JSR OSBYTE

	LDX #NVR_VDUSettings
	CLC
	JSR FRAM_readByte
	TYA
	LSR A
	LSR A
	LSR A
	LSR A
	TAY
	LSR A
	CMP #%00000100
	BCC notNeg
	ORA #%11111000
.notNeg
	TAX
	TYA
	AND #1
	TAY
	LDA #OSB_TVAdjust			\\ set *TV
	JSR OSBYTE
	LDA TempSpace				\\ get screen mode (other bits ignored)
	JSR ScreenInit				\\ reset video with new settings

	LDX #NVR_CapsFDSettings
	CLC
	JSR FRAM_readByte
	TYA
	LSR A
	LSR A
	LSR A
	LSR A
	BCS shCaps
	LSR A
	BCC caps
	LDX #%00110000
	BCS doCaps
.shCaps
	LDX #%10100000
.doCaps
	LDY #%01001000
	LDA #OSB_CapsSetting		\\ set caps lock setting
	JSR OSBYTE
	LDA #OSB_CapsLEDs			\\ set caps lock LEDs
	JSR OSBYTE
.caps
	
	LDX #NVR_KeyRptDelay
	CLC
	JSR FRAM_readByte
	TYA
	TAX
	LDA #OSB_KeyRptDelay		\\ set keyboard repeat delay
	JSR OSBYTE

	LDX #NVR_KeyRptRate
	CLC
	JSR FRAM_readByte
	TYA
	TAX
	LDA #OSB_KeyRtpRate			\\ set keyboard repeat period
	JSR OSBYTE
	
	LDX #NVR_PrinterIgnore
	CLC
	JSR FRAM_readByte
	TYA
	TAX
	LDA #OSB_PrinterIgnore		\\ set printer ignore character
	JSR OSBYTE
	
	LDX #NVR_TubeSerialPrint
	CLC
	JSR FRAM_readByte
	TYA
	LSR A
	LSR A
	AND #7
	CLC
	ADC #1
	PHA
	TAX
	LDA #OSB_RXBaudRate			\\ set serial receive baud rate
	JSR OSBYTE
	PLA							\\ baud rate
	TAX
	LDA #OSB_TXBaudRate			\\ set serial transmit baud rate
	JSR OSBYTE
	
	LDX #NVR_BellBSFormat
	CLC
	JSR FRAM_readByte
	TYA
	LSR A
	PHA
	AND #1
	BNE loud
	LDY #0
	LDX #192
	LDA #OSB_BellVolume			\\ set bell volume quiet
	JSR OSBYTE
.loud
	PLA
	LSR A
	LSR A
	AND #%00011100
	TAX
	LDY #%11100011
	LDA #OSB_SerialFormat		\\ set serial data format
	JSR OSBYTE
	JMP done

}
