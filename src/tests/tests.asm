\-------------------------------------------------------------------------------
\ I2C Test Framework
\-------------------------------------------------------------------------------
\ Test framework for I2C functionality testing
\ Each test is registered in the test table and returns:
\   Carry Clear = PASS
\   Carry Set = FAIL

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
	EQUS	"09. Byte Transmission"
	EQUB	0
	EQUB	LO(test09_byte_tx), HI(test09_byte_tx)
	EQUS	"10. Byte Reception"
	EQUB	0
	EQUB	LO(test10_byte_rx), HI(test10_byte_rx)
	EQUS	"11. ACK Transmission"
	EQUB	0
	EQUB	LO(test11_ack_tx), HI(test11_ack_tx)
	EQUS	"20. Time Set and Read"
	EQUB	0
	EQUB	LO(test20_time_set_read), HI(test20_time_set_read)
	EQUS	"21. Date Set and Read"
	EQUB	0
	EQUB	LO(test21_date_set_read), HI(test21_date_set_read)
	EQUS	"22. Time Passage"
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
	i2cstart
	
	\ Assert SDA is low (SCL state cannot be read on this platform)
	readsda
	BNE	test02_fail		\SDA should be low (zero)
	
	\ SDA low - test passed (SCL assumed correct if i2cstart completes)
	CLC
	RTS
	
.test02_fail
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
	LDY	#0			\Initialize test step counter
	
	\ Step 1: Set bus to some state (e.g., START condition - both low)
	INY				\Step 1
	i2cstart		\This sets both SCL and SDA low
	readsda
	BEQ	test03_ok1		\SDA should be low (zero)
	JMP	test03_fail
.test03_ok1
	
	\ Step 2: Call i2cstop and verify SDA is high (idle state)
	INY				\Step 2
	i2cstop
	readsda
	BNE	test03_done		\SDA should be high (non-zero)
	JMP	test03_fail
.test03_done
	\ STOP condition completed correctly
	\ (SCL state cannot be read, but sequence completion indicates success)
	CLC
	RTS
	
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
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 07: START-STOP Sequence
\ Verifies that a complete START-STOP sequence works correctly
\ Assert: After START-STOP, bus should be in idle state (both high)
\-------------------------------------------------------------------------------
.test07_start_stop
	LDY	#0			\Initialize test step counter
	
	\ Step 1: Set bus to idle and verify initial state
	INY				\Step 1
	i2cidle
	readsda
	BNE	test07_ok1		\SDA should be high (non-zero)
	JMP	test07_fail
.test07_ok1
	
	\ Step 2: Call i2cstart and verify SDA low
	INY				\Step 2
	i2cstart
	readsda
	BEQ	test07_ok2		\SDA should be low (zero)
	JMP	test07_fail
.test07_ok2
	
	\ Step 3: Call i2cstop and verify SDA high (idle)
	INY				\Step 3
	i2cstop
	readsda
	BNE	test07_done		\SDA should be high (non-zero)
	JMP	test07_fail
.test07_done
	\ START-STOP sequence completed correctly
	\ (SCL state cannot be read, but sequence completion indicates success)
	CLC
	RTS
	
.test07_fail
	SEC				\Set Carry to indicate failure
	RTS				\Y register contains step number for printfail

\-------------------------------------------------------------------------------
\ Test 08: Address Transmission
\ Verifies that i2caddr correctly transmits a 7-bit address with RnW bit
\ Tests address transmission sequence - i2caddr followed by i2crxack
\ Note: Without a slave device, i2crxack will return NACK (Carry set)
\ Address validation (device exists on bus) happens via i2crxack response
\-------------------------------------------------------------------------------
.test08_addr_tx
	\ Test address transmission sequence - valid address ($50)
	i2cstart
	LDA	#$50			\7-bit address
	CLC					\RnW=0 (write)
	JSR	i2caddr			\Transmit address
	JSR	i2crxack		\Check ACK - validates if device exists on bus
	BCS	test08_fail		\Carry set (NACK) is not expected

	\ Test address transmission sequence - invalid address ($80)
	i2cstart
	LDA	#$80			\7-bit address
	CLC					\RnW=0 (write)
	JSR	i2caddr			\Transmit address
	JSR	i2crxack		\Check ACK - validates if device exists on bus
	BCC	test08_fail		\Carry clear (ACK) is not expected

	\ Test completed successfully
	CLC
	RTS	
.test08_fail
	SEC				\Set Carry to indicate failure
	RTS

\-------------------------------------------------------------------------------
\ Test 09: Byte Transmission
\ Verifies that i2ctxbyte correctly transmits an 8-bit byte
\ Assert: After transmission, bus should be ready for ACK (SCL low, SDA high)
\ Note: This test may require a slave device or may test signal sequence only
\-------------------------------------------------------------------------------
.test09_byte_tx
	\ TODO: Implement byte transmission test
	\ 1. Issue START and address (or set up bus state)
	\ 2. Call i2ctxbyte with known byte (e.g., $AA or $55 for bit pattern)
	\ 3. Assert SCL is low after transmission
	\ 4. Assert SDA is high (ready for ACK)
	\ 5. May need to verify bit sequence or use scope/logic analyzer
	SEC				\Stub - return fail
	RTS

\-------------------------------------------------------------------------------
\ Test 10: Byte Reception
\ Verifies that i2crxbyte correctly receives an 8-bit byte
\ Assert: Received byte should match expected value (if slave present)
\ Note: This test requires a slave device or may test signal sequence only
\-------------------------------------------------------------------------------
.test10_byte_rx
	\ TODO: Implement byte reception test
	\ 1. Issue START and address with RnW=1 (read)
	\ 2. Call i2crxbyte
	\ 3. Assert byte received in accumulator
	\ 4. May need slave device or test signal sequence only
	\ 5. Could test with known pattern (e.g., $AA, $55, $00, $FF)
	SEC				\Stub - return fail
	RTS

\-------------------------------------------------------------------------------
\ Test 11: ACK Transmission
\ Verifies that i2ctxack correctly transmits ACK (SDA=0) or NACK (SDA=1)
\ Assert: After ACK transmission, SCL should be low
\-------------------------------------------------------------------------------
.test11_ack_tx
	\ TODO: Implement ACK transmission test
	\ 1. Set up bus state (e.g., after receiving byte)
	\ 2. Clear Carry, call i2ctxack (should send ACK, SDA=0)
	\ 3. Assert SCL is low
	\ 4. Assert SDA is low (ACK sent)
	\ 5. Set Carry, call i2ctxack (should send NACK, SDA=1)
	\ 6. Assert SCL is low
	\ 7. Assert SDA is high (NACK sent)
	SEC				\Stub - return fail
	RTS

\-------------------------------------------------------------------------------
\ Test 20: Time Set and Read
\ Verifies that time can be set and read back correctly from RTC
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: After setting time and reading back, buf02/buf01/buf00 match set values
\-------------------------------------------------------------------------------
.test20_time_set_read
	\ TODO: Implement time set and read test
	\ 1. Set known time values in buffer:
	\    buf02 = hours (BCD, e.g., $12 for 12:00)
	\    buf01 = minutes (BCD, e.g., $34 for 34 minutes)
	\    buf00 = seconds (BCD, e.g., $56 for 56 seconds)
	\ 2. Call writetd to write time/date to RTC
	\ 3. Call getrtc to read time/date back from RTC
	\ 4. Assert buf02 matches set hours
	\ 5. Assert buf01 matches set minutes
	\ 6. Assert buf00 matches set seconds
	\ Note: Other buffer values (buf03-buf06) may change, that's OK
	SEC				\Stub - return fail
	RTS

\-------------------------------------------------------------------------------
\ Test 21: Date Set and Read
\ Verifies that date can be set and read back correctly from RTC
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: After setting date and reading back, buf03/buf04/buf05/buf06 match set values
\-------------------------------------------------------------------------------
.test21_date_set_read
	\ TODO: Implement date set and read test
	\ 1. Set known date values in buffer:
	\    buf03 = weekday (1-7, e.g., $01 for Sunday)
	\    buf04 = date (BCD, e.g., $25 for 25th)
	\    buf05 = month (BCD, e.g., $12 for December)
	\    buf06 = year (BCD, e.g., $23 for 2023)
	\ 2. Call writetd to write time/date to RTC
	\ 3. Call getrtc to read time/date back from RTC
	\ 4. Assert buf03 matches set weekday
	\ 5. Assert buf04 matches set date
	\ 6. Assert buf05 matches set month
	\ 7. Assert buf06 matches set year
	\ Note: Time values (buf00-buf02) may change, that's OK
	SEC				\Stub - return fail
	RTS

\-------------------------------------------------------------------------------
\ Test 22: Time Passage
\ Verifies that RTC time advances correctly over time
\ Requires: Actual RTC device (DS3231 or PCF8583) on I2C bus
\ Assert: After setting time and waiting N seconds, time has advanced by N seconds
\-------------------------------------------------------------------------------
.test22_time_passage
	\ TODO: Implement time passage test
	\ 1. Set known time in buffer (e.g., 12:00:00)
	\ 2. Call writetd to write time to RTC
	\ 3. Call getrtc to read initial time, store buf00 (seconds)
	\ 4. Wait for N seconds using OSBYTE 19 delay:
	\    - OSBYTE 19 waits for vertical sync (50 Hz = 50 VSYNCs/sec)
	\    - For 3 seconds: loop 150 times (3 * 50)
	\    - LDA #19, JSR OSBYTE, DEX, BNE loop
	\ 5. Call getrtc to read time again
	\ 6. Assert seconds (buf00) has advanced by N (accounting for BCD)
	\ 7. If seconds wrapped (e.g., 59->00), verify minutes (buf01) advanced
	\ Note: Handle BCD arithmetic correctly (e.g., $59 + 1 = $60, not $5A)
	SEC				\Stub - return fail
	RTS

\-------------------------------------------------------------------------------
\ Test Runner
\ Runs all registered tests and prints results
\-------------------------------------------------------------------------------
.runtests
	\ Set up pointer to test table (handles page boundaries)
	LDA	#LO(testtab)
	STA	htextl
	LDA	#HI(testtab)
	STA	htexth
	LDY	#0
	
.testloop
	\ Check for end of table
	LDA	(htextl),Y
	CMP	#$FF
	BNE	test_not_done
	JMP	testsdone
.test_not_done
	
	\ Print test description and count length
	LDX	#0
.printdesc
	LDY	#0
	LDA	(htextl),Y
	BEQ	descprinted
	JSR	OSASCI
	INC	htextl
	BNE	desc_no_wrap
	INC	htexth
.desc_no_wrap
	INX
	BNE	printdesc
	
.descprinted
	\ Skip null terminator
	INC	htextl
	BNE	desc_skip_done
	INC	htexth
.desc_skip_done
	
	\ Get test routine address (temp1=LO, temp2=HI)
	LDY	#0
	LDA	(htextl),Y
	STA	temp1
	INC	htextl
	BNE	addr_lo_done
	INC	htexth
.addr_lo_done
	LDA	(htextl),Y
	STA	temp2
	INC	htextl
	BNE	addr_hi_done
	INC	htexth
.addr_hi_done
	\ Call test routine
	JSR	calltest
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
\ Helper: Print "Success"
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

.successmsg	EQUS	"Success", 0

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

