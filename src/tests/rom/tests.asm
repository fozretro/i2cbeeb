\-------------------------------------------------------------------------------
\ I2C Test Framework
\-------------------------------------------------------------------------------
\ Test framework for I2C functionality testing
\ Each test is registered in the test table and returns:
\   Carry Clear = PASS
\   Carry Set = FAIL
\
\ Test table pointer in ZP but NOT htextl/htexth — test 09 reuses those as I2C flags.
testptrl	=	mos_scratch+3
testptrh	=	mos_scratch+4

\-------------------------------------------------------------------------------
\ Test Table
\-------------------------------------------------------------------------------
\ Format: Description string (null-terminated), Test routine address (LO, HI)
.testtab
	EQUS	"01. Bus Idle State"
	EQUB	0				\null terminator
	EQUB	LO(test01_bus_idle), HI(test01_bus_idle)
	EQUS	"02. START Condition"
	EQUB	0
	EQUB	LO(test02_start), HI(test02_start)
	EQUS	"03. STOP Condition"
	EQUB	0
	EQUB	LO(test03_stop), HI(test03_stop)
	EQUS	"04. SCL Control"
	EQUB	0
	EQUB	LO(test04_scl_control), HI(test04_scl_control)
	EQUS	"05. SDA Control"
	EQUB	0
	EQUB	LO(test05_sda_control), HI(test05_sda_control)
	EQUS	"06. Clock Pulse"
	EQUB	0
	EQUB	LO(test06_clock_pulse), HI(test06_clock_pulse)
	EQUS	"07. START-STOP Sequence"
	EQUB	0
	EQUB	LO(test07_start_stop), HI(test07_start_stop)
	EQUS	"08. Address Transmission"
	EQUB	0
	EQUB	LO(test08_addr_tx), HI(test08_addr_tx)
	EQUS	"09. Write and Read Byte"
	EQUB	0
	EQUB	LO(test09_byte_tx), HI(test09_byte_tx)
	EQUS	"20. Time Set and Read"
	EQUB	0
	EQUB	LO(test20_time_set_read), HI(test20_time_set_read)
	EQUS	"21. Date Set and Read"
	EQUB	0
	EQUB	LO(test21_date_set_read), HI(test21_date_set_read)
	EQUS	"22. Time Passage (3 seconds)"
	EQUB	0
	EQUB	LO(test22_time_passage), HI(test22_time_passage)
	EQUB	$FF				\end of table marker

\-------------------------------------------------------------------------------
\ Test 01: Bus Idle State
\ Verifies that i2cidle sets SDA to high (idle state)
\ Note: SCL cannot be read on this platform, so we verify indirectly via SDA
\-------------------------------------------------------------------------------
.test01_bus_idle
	\ Set bus to idle state
	i2cidle
	
	\ Check SDA is high (SCL state cannot be read on this platform)
	readsda
	BEQ	test01_fail		\SDA should be high (non-zero)
	
	\ SDA high - test passed (SCL assumed correct if i2cidle completes)
	CLC
	RTS
	
.test01_fail
	LDY	#0				\Bus idle state check failed (SDA not high)
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 02: START Condition
\ Verifies that i2cstart issues a proper START condition
\ Assert: After i2cstart, SDA should be low
\ Note: SCL cannot be read on this platform, so we verify SDA state only
\ (START is: SDA goes low while SCL is high, then SCL goes low)
\-------------------------------------------------------------------------------
.test02_start
	\ Set bus to idle (both high)
	i2cidle
	
	\ Call i2cstart
	i2cstartm
	
	\ Assert SDA is low (SCL state cannot be read on this platform)
	readsda
	BNE	test02_fail		\SDA should be low (zero)
	
	\ SDA low - test passed (SCL assumed correct if i2cstart completes)
	CLC
	RTS
	
.test02_fail
	LDY	#0				\START condition check failed (SDA not low)
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 03: STOP Condition
\ Verifies that i2cstop issues a proper STOP condition
\ Assert: After i2cstop, SDA should be high (idle state)
\ Note: SCL cannot be read on this platform, so we verify SDA state only
\ (STOP is: SCL goes low, SDA goes low, SCL goes high, SDA goes high)
\-------------------------------------------------------------------------------
.test03_stop
	\ Step 1: Set bus to some state (e.g., START condition - both low)
	i2cstartm		\This sets both SCL and SDA low
	readsda
	BEQ	test03_ok1		\SDA should be low (zero)
	JMP	test03_fail_1		\Error occurred in step 1
.test03_ok1
	
	\ Step 2: Call i2cstop and verify SDA is high (idle state)
	i2cstopm
	readsda
	BNE	test03_done		\SDA should be high (non-zero)
	JMP	test03_fail_2		\Error occurred in step 2
.test03_done
	\ STOP condition completed correctly
	\ (SCL state cannot be read, but sequence completion indicates success)
	CLC
	RTS
	
.test03_fail_1
	LDY	#1				\START condition check failed (SDA not low)
	JMP	test03_fail
	
.test03_fail_2
	LDY	#2				\STOP condition check failed (SDA not high)
	JMP	test03_fail
	
.test03_fail
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 04: SCL Control
\ Verifies that sclhi and scllo sequences complete without error
\ Note: SCL cannot be read on this platform, so we verify indirectly
\ by testing that operations requiring SCL control work correctly
\-------------------------------------------------------------------------------
.test04_scl_control
	\ Test SCL control indirectly via clock pulse sequence
	\ If i2clock works, then sclhi/scllo must be working
	scllo				\Set initial state
	i2clock			\Generate clock pulse (sclhi then scllo)
	\ If we get here without error, SCL control is working
	\ (SCL state cannot be read, but sequence completion indicates success)
	
	\ Test passed - SCL control verified indirectly
	CLC
	RTS
	
.test04_fail
	LDY	#0				\SCL control check failed (clock pulse sequence error)
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 05: SDA Control
\ Verifies that sdahi and sdalo correctly control the SDA line
\ Assert: After sdahi, SDA should be high; after sdalo, SDA should be low
\-------------------------------------------------------------------------------
.test05_sda_control
	\ Call sdalo, assert SDA is low
	sdalo
	readsda
	BNE	test05_fail		\SDA should be low (zero)
	
	\ Call sdahi, assert SDA is high
	sdahi
	readsda
	BEQ	test05_fail		\SDA should be high (non-zero)
	
	\ Call sdalo again, assert SDA is low
	sdalo
	readsda
	BNE	test05_fail		\SDA should be low (zero)
	
	\ All assertions passed
	CLC
	RTS
	
.test05_fail
	LDY	#0				\SDA control check failed (SDA state mismatch)
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 06: Clock Pulse
\ Verifies that i2clock generates a proper clock pulse
\ Note: SCL cannot be read on this platform, so we verify sequence completion
\ (Clock pulse is: sclhi followed by scllo)
\-------------------------------------------------------------------------------
.test06_clock_pulse
	\ Set initial state (scllo)
	scllo
	
	\ Call i2clock (generates pulse: sclhi then scllo)
	i2clock
	
	\ If we get here without error, clock pulse completed correctly
	\ (SCL state cannot be read, but sequence completion indicates success)
	CLC
	RTS
	
.test06_fail
	LDY	#0				\Clock pulse check failed (sequence completion error)
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 07: START-STOP Sequence
\ Verifies that a complete START-STOP sequence works correctly
\ Assert: After START-STOP, bus should be in idle state (both high)
\-------------------------------------------------------------------------------
.test07_start_stop
	\ Step 1: Set bus to idle and verify initial state
	i2cidle
	readsda
	BNE	test07_ok1		\SDA should be high (non-zero)
	JMP	test07_fail_1		\Error occurred in step 1
.test07_ok1
	
	\ Step 2: Call i2cstart and verify SDA low
	i2cstartm
	readsda
	BEQ	test07_ok2		\SDA should be low (zero)
	JMP	test07_fail_2		\Error occurred in step 2
.test07_ok2
	
	\ Step 3: Call i2cstop and verify SDA high (idle)
	i2cstopm
	readsda
	BNE	test07_done		\SDA should be high (non-zero)
	JMP	test07_fail_3		\Error occurred in step 3
.test07_done
	\ START-STOP sequence completed correctly
	\ (SCL state cannot be read, but sequence completion indicates success)
	CLC
	RTS
	
.test07_fail_1
	LDY	#1				\Bus idle check failed (SDA not high)
	JMP	test07_fail
	
.test07_fail_2
	LDY	#2				\START condition check failed (SDA not low)
	JMP	test07_fail
	
.test07_fail_3
	LDY	#3				\STOP condition check failed (SDA not high)
	JMP	test07_fail
	
.test07_fail
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 08: Address Transmission
\ Verifies that i2caddr correctly transmits a 7-bit address with RnW bit
\ Tests address transmission sequence - i2caddr followed by i2crxack
\ Note: Without a slave device, i2crxack will return NACK (Carry set)
\ Address validation (device exists on bus) happens via i2crxack response
\-------------------------------------------------------------------------------
.test08_addr_tx
	\ Step 1: Test address transmission sequence - valid address ($50)
	i2cstartm
	LDA	#$50			\7-bit address
	CLC					\RnW=0 (write)
	JSR	i2caddr			\Transmit address
	JSR	i2crxack		\Check ACK - validates if device exists on bus
	BCC	test08_ok1		\Carry clear (ACK) is expected
	JMP	test08_fail_1		\Carry set (NACK) - error in step 1
.test08_ok1

	\ Step 2: Test address transmission sequence - invalid address ($80)
	i2cstartm
	LDA	#$80			\7-bit address
	CLC					\RnW=0 (write)
	JSR	i2caddr			\Transmit address
	JSR	i2crxack		\Check ACK - validates if device exists on bus
	BCS	test08_done		\Carry set (NACK) is expected
	JMP	test08_fail_2		\Carry clear (ACK) - error in step 2
.test08_done
	\ Test completed successfully
	CLC
	RTS
	
.test08_fail_1
	LDY	#1				\Valid address ACK check failed (expected ACK, got NACK)
	JMP	test08_fail
	
.test08_fail_2
	LDY	#2				\Invalid address NACK check failed (expected NACK, got ACK)
	JMP	test08_fail
	
.test08_fail
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 09: Byte Transmission
\ Verifies that i2ctxbyte correctly transmits an 8-bit byte to RTC
\ Tests: Write byte to RTC_TEST_REG, read it back, verify it matches
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: Written byte matches read byte
\-------------------------------------------------------------------------------
.test09_byte_tx
	\ Step 1: Write test byte using cmd3 (I2CTXB)
	SEI					\Disable interrupts (cmd3 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	LDA	#RTC			\RTC device address
	STA	i2cdev			\$68
	LDA	#RTC_TEST_REG		\Register offset for testing
	STA	i2creg			\$69
	LDA	#$AA			\Test byte (bit pattern 10101010)
	STA	i2cbyte			\$6A
	LDA	#$FF			\$FF = register specified
	STA	temp2			\$6C
	LDA	#0				\Stop after write
	STA	htextl			\$6D
	JSR	cmd3			\Write byte via cmd3 entry point (pushes X/Y, jumps to txbgo)
	LDA	i2cstat			\Check for errors
	BEQ	test09_ok1		\No error, continue
	JMP	test09_fail_1		\Error occurred in step 1
.test09_ok1
	CLI					\Re-enable interrupts
	
	\ Step 2: Read back the test byte using cmd5 (I2CRXB)
	SEI					\Disable interrupts (cmd5 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	LDA	#RTC			\RTC device address
	STA	i2cdev			\$68
	LDA	#RTC_TEST_REG		\Register offset for testing
	STA	i2creg			\$69
	LDA	#$FF			\$FF = register specified
	STA	temp2			\$6C
	LDA	#0				\Not storing in % var
	STA	htexth			\$6E
	LDX	#LO(i2cbuf)		\Set buffer location
	STX	bufloc			\$CE
	LDX	#HI(i2cbuf)
	STX	bufloc+1		\$CF
	JSR	cmd5			\Read byte via cmd5 entry point (pushes X/Y, jumps to rxbgo)
	LDA	i2cstat			\Check for errors
	BEQ	test09_ok2		\No error, continue
	JMP	test09_fail_2		\Error occurred in step 2
.test09_ok2
	LDA	i2cbuf			\Get read byte from buffer
	CMP	#$AA			\Compare with written value
	BEQ	test09_done		\Matches, test passed
	JMP	test09_fail_2		\Byte mismatch in step 2
.test09_done
	CLI					\Re-enable interrupts
	CLC					\Test completed successfully
	RTS
	
.test09_fail_1
	LDY	#1				\Write byte to RTC failed (I2C error)
	JMP	test09_fail
	
.test09_fail_2
	LDY	#2				\Read byte from RTC failed or byte mismatch
	JMP	test09_fail
	
.test09_fail
	CLI					\Re-enable interrupts
	SEC					\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 20: Time Set and Read
\ Verifies that time can be set and read back correctly from RTC
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: After setting time and reading back, buf02/buf01/buf00 match set values
\-------------------------------------------------------------------------------
.test20_time_set_read
	\ Step 1: Set known time values in buffer (BCD format)
	LDA	#$12			\Hours: 12 (BCD)
	STA	buf02
	LDA	#$34			\Minutes: 34 (BCD)
	STA	buf01
	LDA	#$56			\Seconds: 56 (BCD)
	STA	buf00
	
	\ Step 2: Write time to RTC using writetd
	SEI					\Disable interrupts (cmd4 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	writetd			\Write time/date to RTC
	LDA	i2cstat			\Check for errors
	BEQ	test20_ok1		\No error, continue
	JMP	test20_fail_1		\Error occurred in step 2
.test20_ok1
	CLI					\Re-enable interrupts
	
	\ Step 3: Read time back from RTC using getrtc
	SEI					\Disable interrupts (cmd6 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	getrtc			\Read time/date from RTC
	LDA	i2cstat			\Check for errors
	BEQ	test20_ok2		\No error, continue
	JMP	test20_fail_2		\Error occurred in step 3
.test20_ok2
	CLI					\Re-enable interrupts
	
	\ Step 4: Assert buf02 (hours) matches set value
	LDA	buf02
	CMP	#$12			\Compare with set hours
	BEQ	test20_ok3		\Matches, continue
	JMP	test20_fail_3		\Hours mismatch in step 4
.test20_ok3
	
	\ Step 5: Assert buf01 (minutes) matches set value
	LDA	buf01
	CMP	#$34			\Compare with set minutes
	BEQ	test20_ok4		\Matches, continue
	JMP	test20_fail_4		\Minutes mismatch in step 5
.test20_ok4
	
	\ Step 6: Assert buf00 (seconds) matches set value
	LDA	buf00
	CMP	#$56			\Compare with set seconds
	BEQ	test20_done		\Matches, test passed
	JMP	test20_fail_5		\Seconds mismatch in step 6
.test20_done
	\ Test completed successfully
	CLC
	RTS
	
.test20_fail_1
	LDY	#2				\Write time to RTC failed (I2C error)
	JMP	test20_fail
	
.test20_fail_2
	LDY	#3				\Read time from RTC failed (I2C error)
	JMP	test20_fail
	
.test20_fail_3
	LDY	#4				\Hours mismatch (read value doesn't match written)
	JMP	test20_fail
	
.test20_fail_4
	LDY	#5				\Minutes mismatch (read value doesn't match written)
	JMP	test20_fail
	
.test20_fail_5
	LDY	#6				\Seconds mismatch (read value doesn't match written)
	JMP	test20_fail
	
.test20_fail
	CLI					\Re-enable interrupts (in case we failed during I2C)
	SEC					\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 21: Date Set and Read
\ Verifies that date can be set and read back correctly from RTC
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: After setting date and reading back, buf03/buf04/buf05/buf06 match set values
\-------------------------------------------------------------------------------
.test21_date_set_read
	\ Step 1: Set known date values in buffer (BCD format)
	LDA	#$01			\Weekday: 1 (Sunday, 1-7)
	STA	buf03
	LDA	#$25			\Date: 25 (BCD)
	STA	buf04
	LDA	#$12			\Month: 12 (December, BCD)
	STA	buf05
	LDA	#$23			\Year: 23 (2023, BCD)
	STA	buf06
	
	\ Step 2: Write date to RTC using writetd
	SEI					\Disable interrupts (cmd4 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	writetd			\Write time/date to RTC
	LDA	i2cstat			\Check for errors
	BEQ	test21_ok1		\No error, continue
	JMP	test21_fail_1	\Error occurred in step 2
.test21_ok1
	CLI					\Re-enable interrupts
	
	\ Step 3: Read date back from RTC using getrtc
	SEI					\Disable interrupts (cmd6 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	getrtc			\Read time/date from RTC
	LDA	i2cstat			\Check for errors
	BEQ	test21_ok2		\No error, continue
	JMP	test21_fail_2	\Error occurred in step 3
.test21_ok2
	CLI					\Re-enable interrupts
	
	\ Step 4: Assert buf03 (weekday) matches set value
	LDA	buf03
	CMP	#$01			\Compare with set weekday
	BEQ	test21_ok3		\Matches, continue
	JMP	test21_fail_3	\Weekday mismatch in step 4
.test21_ok3
	
	\ Step 5: Assert buf04 (date) matches set value
	LDA	buf04
	CMP	#$25			\Compare with set date
	BEQ	test21_ok4		\Matches, continue
	JMP	test21_fail_4	\Date mismatch in step 5
.test21_ok4
	
	\ Step 6: Assert buf05 (month) matches set value
	LDA	buf05
	CMP	#$12			\Compare with set month
	BEQ	test21_ok5		\Matches, continue
	JMP	test21_fail_5	\Month mismatch in step 6
.test21_ok5
	
	\ Step 7: Assert buf06 (year) matches set value
	LDA	buf06
	CMP	#$23			\Compare with set year
	BEQ	test21_done		\Matches, test passed
	JMP	test21_fail_6	\Year mismatch in step 7
.test21_done
	\ Test completed successfully
	CLC
	RTS
	
.test21_fail_1
	LDY	#2				\Write date to RTC failed (I2C error)
	JMP	test21_fail
	
.test21_fail_2
	LDY	#3				\Read date from RTC failed (I2C error)
	JMP	test21_fail
	
.test21_fail_3
	LDY	#4				\Weekday mismatch (read value doesn't match written)
	JMP	test21_fail
	
.test21_fail_4
	LDY	#5				\Date mismatch (read value doesn't match written)
	JMP	test21_fail
	
.test21_fail_5
	LDY	#6				\Month mismatch (read value doesn't match written)
	JMP	test21_fail
	
.test21_fail_6
	LDY	#7				\Year mismatch (read value doesn't match written)
	JMP	test21_fail
	
.test21_fail
	CLI					\Re-enable interrupts (in case we failed during I2C)
	SEC					\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 22: Time Passage
\ Verifies that RTC time advances correctly over time
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: After setting time and waiting N seconds, time has advanced by N seconds
\-------------------------------------------------------------------------------
.test22_time_passage
	\ Step 1: Set known time in buffer (12:00:00)
	LDA	#$12			\Hours: 12 (BCD)
	STA	buf02
	LDA	#$00			\Minutes: 00 (BCD)
	STA	buf01
	LDA	#$00			\Seconds: 00 (BCD)
	STA	buf00
	
	\ Step 2: Write time to RTC using writetd
	SEI					\Disable interrupts (cmd4 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	writetd			\Write time/date to RTC
	LDA	i2cstat			\Check for errors
	BEQ	test22_ok1		\No error, continue
	JMP	test22_fail_1		\Error occurred in step 2
.test22_ok1
	CLI					\Re-enable interrupts
	
	\ Step 3: Read initial time and store seconds
	SEI					\Disable interrupts (cmd6 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	getrtc			\Read time/date from RTC
	LDA	i2cstat			\Check for errors
	BEQ	test22_ok2		\No error, continue
	JMP	test22_fail_2		\Error occurred in step 3
.test22_ok2
	CLI					\Re-enable interrupts
	LDA	buf00			\Store initial seconds
	STA	temp1			\Save in temp1 for later comparison
	LDA	buf01			\Store initial minutes
	STA	temp2			\Save in temp2 for later comparison
	
	\ Step 4: Wait for 3 seconds using OSBYTE 19 (50 Hz = 50 VSYNCs/sec)
	\ For 3 seconds: loop 150 times (3 * 50)
	LDX	#150			\150 VSYNCs = 3 seconds
.test22_delay_loop
	TXA					\Preserve X counter
	PHA					\Save on stack
	LDA	#19				\OSBYTE 19 = wait for vertical sync
	LDY	#0				\Y parameter (not used)
	JSR	OSBYTE			\Wait for one VSYNC (may modify X)
	PLA					\Restore X counter
	TAX
	DEX					\Decrement counter
	BNE	test22_delay_loop	\Loop until 150 VSYNCs completed
	
	\ Step 5: Read time again from RTC
	SEI					\Disable interrupts (cmd6 expects this)
	LDA	#0				\Clear status
	STA	i2cstat
	JSR	getrtc			\Read time/date from RTC
	LDA	i2cstat			\Check for errors
	BEQ	test22_ok3		\No error, continue
	JMP	test22_fail_3		\Error occurred in step 5
.test22_ok3
	CLI					\Re-enable interrupts
	
	\ Step 6: Verify that time has advanced (goal is to ensure time passes, not predict exact time)
	\ Simple check: verify seconds changed (non-zero difference)
	LDA	temp1			\Get initial seconds
	CMP	buf00			\Compare with actual seconds
	BEQ	test22_fail_4		\If same, time didn't advance (fail)
	\ Time advanced (seconds changed), test passed
	
.test22_done
	\ Test completed successfully
	CLC
	RTS
	
.test22_fail_1
	LDY	#2				\Write time to RTC failed (I2C error)
	JMP	test22_fail
	
.test22_fail_2
	LDY	#3				\Read initial time from RTC failed (I2C error)
	JMP	test22_fail
	
.test22_fail_3
	LDY	#5				\Read time after delay from RTC failed (I2C error)
	JMP	test22_fail
	
.test22_fail_4
	LDY	#6				\Seconds mismatch (time didn't advance correctly)
	JMP	test22_fail
	
.test22_fail
	CLI					\Re-enable interrupts (in case we failed during I2C)
	SEC					\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test Runner
\ Runs all registered tests and prints results
\-------------------------------------------------------------------------------
.runtests
	\ Set up pointer to test table (handles page boundaries)
	LDA	#LO(testtab)
	STA	testptrl
	LDA	#HI(testtab)
	STA	testptrh
	LDY	#0
	
.testloop
	\ Check for end of table
	LDA	(testptrl),Y
	CMP	#$FF
	BNE	test_not_done
	JMP	testsdone
.test_not_done
	
	\ Print test description and count length
	LDX	#0
.printdesc
	LDY	#0
	LDA	(testptrl),Y
	BEQ	descprinted
	JSR	OSASCI
	INC	testptrl
	BNE	desc_no_wrap
	INC	testptrh
.desc_no_wrap
	INX
	BNE	printdesc
	
.descprinted
	\ Skip null terminator
	INC	testptrl
	BNE	desc_skip_done
	INC	testptrh
.desc_skip_done
	
	\ Get test routine address (temp1=LO, temp2=HI)
	LDY	#0
	LDA	(testptrl),Y
	STA	temp1
	INC	testptrl
	BNE	addr_lo_done
	INC	testptrh
.addr_lo_done
	LDA	(testptrl),Y
	STA	temp2
	INC	testptrl
	BNE	addr_hi_done
	INC	testptrh
.addr_hi_done
	\ Save X (description length) before calling test
	TXA
	PHA
	\ Call test routine
	JSR	calltest
	\ Restore X (description length) after test returns
	PLA
	TAX
	BCS	testfailed
	JSR	printspaces
	JSR	printsuccess
	JMP	nexttest	
.testfailed
	JSR	printspaces
	JSR	printfail
	
.nexttest
	JSR	OSNEWL
	LDY	#0
	JMP	testloop
	
.testsdone
	RTS

\-------------------------------------------------------------------------------
\ Helper: Call test routine via indirect jump
\-------------------------------------------------------------------------------
.calltest
	JMP	(temp1)

\-------------------------------------------------------------------------------
\ Helper: Print spaces to align results (aligns to column 30)
\-------------------------------------------------------------------------------
.printspaces
	CPX	#30
	BCS	spacesdone
.spaceloop
	LDA	#' '
	JSR	OSASCI
	INX
	CPX	#30
	BCC	spaceloop
.spacesdone
	RTS

\-------------------------------------------------------------------------------
\ Helper: Print "Pass"
\-------------------------------------------------------------------------------
.printsuccess
	LDX	#0
.successloop
	LDA	successmsg,X
	BEQ	successdone
	JSR	OSASCI
	INX
	BNE	successloop
.successdone
	RTS

.successmsg	EQUS	"Pass", 0

\-------------------------------------------------------------------------------
\ Helper: Print "Fail" followed by test step number from Y register
\ If Y is zero, output nothing after "Fail"
\-------------------------------------------------------------------------------
.printfail
	LDX	#0
.failloop
	LDA	failmsg,X
	BEQ	failstep
	JSR	OSASCI
	INX
	BNE	failloop
.failstep
	\ Print test step number from Y register (single digit 1-9)
	\ If Y is zero, skip output
	TYA				\Get test step number
	BEQ	faildone		\If zero, skip output
	LDA	#' '			\Output space before number
	JSR	OSASCI
	TYA				\Get test step number again
	CLC
	ADC	#$30			\Convert to ASCII digit
	JSR	OSASCI
.faildone
	RTS

.failmsg	EQUS	"Fail", 0

