\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ NVRAM Abstraction Layer
\ Replaces VIA.asm FRAM access with I2C EEPROM access
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\ NVRAM address offset in I2C EEPROM
\ Using 24C32 EEPROM at address &57 (EEP32)
\ NVRAM data starts at EEPROM address 0
NVRAM_EEPROM_BASE = 0

\ Temporary buffer for single-byte NVRAM operations
\ Uses buf08 ($0388) which is unused by RTC operations
NVRAM_TEMP = buf08

\ FRAM_readByte - Read a byte from NVRAM
\ On entry: X = NVRAM address (0-255)
\           C = high address bit (0 for addresses 0-255)
\ On exit:  Y = byte value read
\           C = preserved
\           A = preserved (if possible)
\           X = preserved
.FRAM_readByte
{
	PHP					\ Save C flag
	PHA					\ Save A
	STX temp1			\ Save X in temp1
	
	\ Calculate EEPROM address
	LDA #NVRAM_EEPROM_BASE AND &FF
	CLC
	ADC temp1			\ Add NVRAM address
	STA eeplo
	LDA #(NVRAM_EEPROM_BASE >> 8) AND &FF
	ADC #0				\ Add carry if any
	STA eephi
	
	\ Use existing eeprd routine for single-byte read
	\ Set up buffer pointer to temp location
	LDA #LO(NVRAM_TEMP)
	STA bufloc
	LDA #HI(NVRAM_TEMP)
	STA bufloc+1
	
	\ Call eeprd with A=1 (single byte)
	LDA #1
	JSR eeprd
	
	\ Read result from temp buffer
	LDY #0
	LDA (bufloc),Y
	TAY					\ Return value in Y
	
	LDX temp1			\ Restore X
	PLA					\ Restore A
	PLP					\ Restore C
	RTS
}

\ FRAM_writeByte - Write a byte to NVRAM
\ On entry: X = NVRAM address (0-255)
\           Y = byte value to write
\           C = high address bit (0 for addresses 0-255)
\ On exit:  C = preserved
\           A = preserved (if possible)
\           X = preserved
\           Y = preserved
.FRAM_writeByte
{
	PHP					\ Save C flag
	PHA					\ Save A
	STX temp1			\ Save X in temp1
	STY temp2			\ Save Y (byte to write) in temp2
	
	\ Calculate EEPROM address
	LDA #NVRAM_EEPROM_BASE AND &FF
	CLC
	ADC temp1			\ Add NVRAM address
	STA eeplo
	LDA #(NVRAM_EEPROM_BASE >> 8) AND &FF
	ADC #0				\ Add carry if any
	STA eephi
	
	\ Store byte to write in temp buffer
	LDA #LO(NVRAM_TEMP)
	STA bufloc
	LDA #HI(NVRAM_TEMP)
	STA bufloc+1
	LDY #0
	LDA temp2			\ Get byte to write
	STA (bufloc),Y
	
	\ Use existing eepwr routine for single-byte write
	LDA #1
	JSR eepwr
	
	LDX temp1			\ Restore X
	LDY temp2			\ Restore Y
	PLA					\ Restore A
	PLP					\ Restore C
	RTS
}

\ VIA_setup - Stub for VIA initialization
\ Not needed for I2C, but may be called by some routines
\ Note: Configure.asm defines CON_ReadKeySwitches which uses VIA
\ This will need platform-specific handling for Electron/AP6
.VIA_setup
{
	RTS
}

