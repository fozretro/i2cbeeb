\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ NVRAM Abstraction Layer
\ Uses PCF8583 RTC free RAM (registers 12h onwards) for NVRAM storage
\\
\ Logical NVRAM 0-17: configure ROM (0-16 = SET_DefaultsTable, 17 = init marker)
\ Logical 18-237: spare (chip 2Ah-FFh). Logical 238+ wraps into clock / RTC 10h-11h.
\ Chip 10h-11h: RTC year offset / year copy + *TBRK — not configure logical addresses.
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\ PCF8583 free RAM starts at register 12h (18 decimal)
\ NVRAM address (0-255) maps to PCF8583 register (12h + NVRAM address, low 8 bits)
PCF8583_NVRAM_BASE = $12
NVRAM_MAX_OFFSET = 237

\ Temporary buffer for single-byte NVRAM operations
\ Uses buf08 ($0388) which is unused by RTC operations
NVRAM_TEMP = buf08

\ FRAM_readByte - Read a byte from NVRAM (PCF8583 RAM)
\ On entry: X = NVRAM address (0-255)
\           C = high address bit (0 for addresses 0-255)
\ On exit:  Y = byte value read
\           C = preserved
\           A = not preserved (matches original)
\           X = preserved (input parameter)
.FRAM_readByte
{
	PHP					\ Save C flag
	STX temp1			\ Save X in temp1 for register calculation
	
	\ Calculate PCF8583 register address
	LDA #PCF8583_NVRAM_BASE
	CLC
	ADC temp1			\ Add NVRAM address (0-255)
	STA i2creg			\ Register number
	
	\ Set up for single-byte read from PCF8583
	LDA #RTC			\ PCF8583 RTC device address
	STA i2cdev
	LDA #$FF			\ Register specified
	STA temp2
	LDA #LO(NVRAM_TEMP)	\ Buffer pointer for read
	STA bufloc
	LDA #HI(NVRAM_TEMP)
	STA bufloc+1
	LDA #0				\ Don't store in % variable
	STA htexth
	
	\ Call cmd5 (I2CRXB entry point) - it pushes X/Y and jumps to rxbgo
	\ rxbgo does SEI/CLI internally (interrupts enabled on exit)
	JSR cmd5
	
	\ Read result from temp buffer (rxbgo stored it at NVRAM_TEMP)
	LDY NVRAM_TEMP		\ Return value in Y
	
	\ cmd5/rxbgo already restored X/Y from stack (to original values)
	PLP					\ Restore C flag
	RTS
}

\ FRAM_writeByte - Write a byte to NVRAM (PCF8583 RAM)
\ On entry: X = NVRAM address (0-255)
\           Y = byte value to write
\           C = high address bit (0 for addresses 0-255)
\ On exit:  C = preserved
\           A = not preserved (matches original)
\           X = preserved (input parameter)
\           Y = preserved (input parameter)
.FRAM_writeByte
{
	PHP					\ Save C flag
	STX temp1			\ Save X in temp1 for register calculation
	TYA
	STA i2cbyte			\ Save byte value to write in i2cbyte
	
	\ Calculate PCF8583 register address
	LDA #PCF8583_NVRAM_BASE
	CLC
	ADC temp1			\ Add NVRAM address (0-255)
	STA i2creg			\ Register number
	
	\ Set up for single-byte write to PCF8583
	LDA #RTC			\ PCF8583 RTC device address
	STA i2cdev
	LDA #$FF			\ Register specified
	STA temp2
	LDA #0				\ No stop inhibit
	STA htextl
	
	\ Call cmd3 (I2CTXB entry point) - it pushes X/Y and jumps to txbgo
	\ txbgo does SEI/CLI internally (interrupts enabled on exit)
	JSR cmd3
	
	\ cmd3/txbgo already restored X/Y from stack (to original values)
	PLP					\ Restore C flag
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

