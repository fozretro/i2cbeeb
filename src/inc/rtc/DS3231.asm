\-------------------------------------------------------------------------------
\ These implementations of 'getrtc', 'writetd' and 'wtbrk' are DS3231 compatible 
\ The code below simply passes back and forth the data in bufXX to the device
\ unlike the code in /inc/rtc/PCF8583.asm there is no translation needed
\ as the main code for this ROM assumes the DS3231 format
\
\ I2C transaction workspace (i2cdev, i2creg, i2cbyte, temp2, htextl) is defined
\ in I2CBeeb.asm — not hardcoded zero-page addresses. temp2/htextl are reused as
\ register-valid and stop-inhibit flags during internal cmd3/cmd4/cmd6 calls.

RTC			=	$68		\DS3231 I2C slave address on the bus
RTC_TEMP	=	-1		\tempurate is supported for this RTC
RTC_TEST_REG	=	$08		\Register offset for testing byte transmission (Alarm 1 Seconds - unused by ROM, alarms disabled)

\-------------------------------------------------------------------------------
\Gets time and date parameters from RTC into buffer buf00-buf07 @ $0380

.getrtc	
	LDA	#LO(buf00)		\re-direct i2c buffer to buf00
	STA	bufloc			\($0380)
	LDA	#HI(buf00)
	STA	bufloc+1
						\set up rxd call to fetch all RTC data
	LDA	#RTC			\DS3231 RTC device id
	STA	i2cdev
	LDA	#0				\register number - start at 0 (secs)
	STA	i2creg
	LDA	#19				\number of bytes to fetch (addr $00-$12)
	STA	i2cbyte
	STA	temp2				\reg-valid flag to non-zero
	JSR	cmd6			\and make the rxd(go) call
	LDA	#LO(i2cbuf)		\reset I2C buffer to $0A00
	STA	bufloc
	LDA	#HI(i2cbuf)
	STA	bufloc+1
	RTS					\and return

\------------------------------------------------------------------------------
\Writes the 7-byte time and date data set at buf00-buf06 to the DS3231 RTC
\First copies the 7 t&d bytes across to the main I2C buffer at $0A00 and then
\performs the write using an internal txd call.

.writetd	
	LDX	#0				\copy t&d data to I2C buffer
.wtd_a1	
	LDA	buf00,X
	STA	i2cbuf,X
	INX
	CPX	#7				\copying 7 bytes
	BNE	wtd_a1
	LDA	#RTC			\set up txd call
	STA	i2cdev				\slave address
	LDA	#0
	STA	i2creg				\start register
	STA	htextl				\no stop inhibit
	LDA	#7
	STA	i2cbyte				\7 bytes to tx
	STA	temp2				\non-zero = i2creg register valid
	JSR	cmd4			\perform the write via txd(go)
	RTS					\and return

\------------------------------------------------------------------------------
\Writes the toggle state for *TBRK
\the DS3231 does not have free ram, so *TBRK toggle is stored in 12h register
\the 12th register is used (when enabled) for alaram functionlity so safe to use
\since this ROM does not support this feature of the RTC

.wtbrk	
	LDA	#RTC			\target i2c device id (here rtc)
	STA	i2cdev
	STA	temp2				\temp2<>0 mean register specified in i2creg
	LDA	#12				\start register = 12 = Alarm 2 Hours
	STA	i2creg
	LDA	#0
	STA	htextl				\htextl=0 means Stop after txb
	JSR	cmd3			\and send the byte via txb(go)
	RTS

\------------------------------------------------------------------------------
\Additional command line validation for I2CTXB
\routine needs to output its own error message and return carry set if in error state
.txbval    
	RTS       			\ no additional validation for DS3231

\Additional command line validation for I2CTXD
\routine needs to output its own error message and return carry set if in error state
.txdval    
	RTS       			\ no additional validation for DS3231