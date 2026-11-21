\ Minimal AP6 I²C test
\
\ Two targets — pass -D TARGET=n:
\   TARGET=1   sideways ROM  → I2CTROM → Command *I2CTEST [n]
\   TARGET=2   program RAM   → I2CT
\
\ Build with BeebAsm
\   beebasm -i i2ctest.asm -D TARGET=1 -o I2CTROM 
\   beebasm -i i2ctest.asm -D TARGET=2 -o I2CT
\
\ *I2CTEST       — run suite tests 01–10
\ *I2CTEST n     — run only test n (1–10, or 11 = address-TX soak loop)
\
\-------------------------------------------------------------------------------
\ Known behaviour (Electron AP6 / slot 12 / &FCD6):
\   *RUN I2CT works.
\   *I2CTEST with I2CTROM in any sideways slot other than 12 works.
\   *I2CTEST with I2CTROM in slot 12 hangs on test 1 and can corrupt EEPROM.
\   All &FCD6 writes keep D0/D4 set (AP6_SAFE); ORA paths use merged masks, AND paths ORA safe after.
\-------------------------------------------------------------------------------

OSASCI  =	&FFE3
OSNEWL  =	&FFE7
AP6REG  =	&FCD6
\ Initial shadow: SCL/SDA low; D0/D4 high (A14 upper, write inhibited).
AP6IDLE =	&FF
\ OR'd after AND writes — D0/D4 are not read back from &FCD6.
AP6_SAFE=	&11
XSDAHI  =	&80				\ %10000000 — SDA high (D7)
XSDALO  =	&7F				\ %01111111 — SDA low mask (AND clears D7)
XSCLHI  =	&40				\ %01000000 — SCL high (D6)
XSCLLO  =	&BF				\ %10111111 — SCL low mask (AND clears D6)
XSCLHI_SAFE=	XSCLHI + AP6_SAFE
XSDAHI_SAFE=	XSDAHI + AP6_SAFE

RTC     =	&50
USERNV  =	&80
TESTPAT =	&AA

\ Private ZP (&70–&7F): MOS does not use this block during OSASCI (unlike &A8–&AF).
ap6regc =	&70
addrbyte=	&71
testptrl=	&72
testptrh=	&73
temp1   =	&74
temp2   =	&75
comdata =	&76
testsel =	&77				\ 0 = suite 01–10; N = run only test N

\-------------------------------------------------------------------------------
\ AP6 I²C bit-bang (&FCD6). ap6regc tracks SCL/SDA; D0/D4 in each macro ORA/AND.
\-------------------------------------------------------------------------------

\-------------------------------------------------------------------------------
\ SCL driven high via AP6 control register.
\-------------------------------------------------------------------------------
MACRO sclhi
	LDA	ap6regc
	ORA	#XSCLHI_SAFE
	STA	ap6regc
	STA	AP6REG
	NOP
ENDMACRO

\-------------------------------------------------------------------------------
\ SCL driven low via AP6 control register.
\-------------------------------------------------------------------------------
MACRO scllo
	LDA	ap6regc
	AND	#(XSCLLO)
	ORA	#AP6_SAFE
	STA	ap6regc
	STA	AP6REG
	NOP
ENDMACRO

\-------------------------------------------------------------------------------
\ SDA released high (open-drain idle) via AP6 control register.
\-------------------------------------------------------------------------------
MACRO sdahi
	LDA	ap6regc
	ORA	#XSDAHI_SAFE
	STA	ap6regc
	STA	AP6REG
	NOP
ENDMACRO

\-------------------------------------------------------------------------------
\ SDA driven low via AP6 control register.
\-------------------------------------------------------------------------------
MACRO sdalo
	LDA	ap6regc
	AND	#(XSDALO)
	ORA	#AP6_SAFE
	STA	ap6regc
	STA	AP6REG
	NOP
ENDMACRO

\-------------------------------------------------------------------------------
\ Output one address/data bit: SDA mirrors Carry (1 = high, 0 = low).
\-------------------------------------------------------------------------------
MACRO i2cdbit
	BCC	dblo
	sdahi
	BCS	dbx
.dblo
	sdalo
.dbx
	NOP
ENDMACRO

\-------------------------------------------------------------------------------
\ Single positive clock pulse on SCL (sclhi then scllo).
\-------------------------------------------------------------------------------
MACRO i2clock
	sclhi
	scllo
ENDMACRO

\-------------------------------------------------------------------------------
\ Bus idle state: SCL and SDA both high.
\-------------------------------------------------------------------------------
MACRO i2cidle
	scllo
	sdahi
	sclhi
ENDMACRO

\-------------------------------------------------------------------------------
\ STOP condition: SCL low, SDA low, SCL high, SDA high.
\-------------------------------------------------------------------------------
MACRO i2cstopm
	scllo
	sdalo
	sclhi
	sdahi
ENDMACRO

\-------------------------------------------------------------------------------
\ START condition: reset AP6 to idle, then SDA low while SCL high, then SCL low.
\-------------------------------------------------------------------------------
MACRO i2cstartm
	LDA	#AP6IDLE
	STA	ap6regc
	STA	AP6REG
	NOP
	i2cidle
	sdalo
	scllo
ENDMACRO

\-------------------------------------------------------------------------------
\ Read SDA line. A = 0 if low, A != 0 if high.
\-------------------------------------------------------------------------------
MACRO i2creadm
	LDA	AP6REG
	AND	#(XSDAHI)
ENDMACRO

IF TARGET=2

ORG &1900

.start 

ENDIF

IF TARGET=1

ORG &8000

.start
	EQUB	0,0,0
	JMP	service
	EQUB	&82
	EQUB	(copyr-start)
.title
	EQUB	0
	EQUS	"I2CT"
	EQUB	0
.copyr
	EQUB	0
	EQUS	"(C) I2C test repro"
	EQUB	0

ENDIF

\-------------------------------------------------------------------------------
\ Official AP6 bus-level tests 01-10; 09-10 use PCF8583 NVRAM at USERNV.
\ Default *I2CTEST stops at the first $FF. Extra tests after that are numbered
\ only (*I2CTEST n); a second $FF ends the table.
\-------------------------------------------------------------------------------

\-------------------------------------------------------------------------------
\ Test table: null-terminated description, handler address, repeated until $FF.
\-------------------------------------------------------------------------------
.testtab
	EQUS	"01. Bus Idle State"
	EQUB	0
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
	EQUS	"09. Byte Write"
	EQUB	0
	EQUB	LO(test09_byte_write), HI(test09_byte_write)
	EQUS	"10. Byte Read"
	EQUB	0
	EQUB	LO(test10_byte_read), HI(test10_byte_read)
	EQUB	$FF
	EQUS	"11. Address TX Loop"
	EQUB	0
	EQUB	LO(test11_addr_tx_loop), HI(test11_addr_tx_loop)
	EQUB	$FF

\-------------------------------------------------------------------------------
\ Test 01: Bus Idle State
\ Verifies that i2cidle sets SDA high (idle state).
\ SCL cannot be read on AP6, so we check SDA only.
\-------------------------------------------------------------------------------
.test01_bus_idle
	i2cidle
	i2creadm
	BEQ	test01_fail
	CLC
	RTS
.test01_fail
	LDY	#0
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 02: START Condition
\ Verifies that i2cstart issues a proper START condition.
\ Assert: after i2cstart, SDA should be low.
\-------------------------------------------------------------------------------
.test02_start
	i2cidle
	i2cstartm
	i2creadm
	BNE	test02_fail
	CLC
	RTS
.test02_fail
	LDY	#0
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 03: STOP Condition
\ Verifies that i2cstop returns the bus to idle (SDA high).
\ Step 1: START (SDA low). Step 2: STOP (SDA high).
\-------------------------------------------------------------------------------
.test03_stop
	i2cstartm
	i2creadm
	BEQ	test03_ok1
	JMP	test03_fail_1
.test03_ok1
	i2cstopm
	i2creadm
	BNE	test03_done
	JMP	test03_fail_2
.test03_done
	CLC
	RTS
.test03_fail_1
	LDY	#1
	JMP	test03_fail
.test03_fail_2
	LDY	#2
.test03_fail
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 04: SCL Control
\ Verifies sclhi/scllo via a clock pulse sequence.
\ SCL cannot be read; success means i2clock completes without error.
\-------------------------------------------------------------------------------
.test04_scl_control
	scllo
	i2clock
	CLC
	RTS

\-------------------------------------------------------------------------------
\ Test 05: SDA Control
\ Verifies sdahi and sdalo drive SDA high and low as expected.
\-------------------------------------------------------------------------------
.test05_sda_control
	sdalo
	i2creadm
	BNE	test05_fail
	sdahi
	i2creadm
	BEQ	test05_fail
	sdalo
	i2creadm
	BNE	test05_fail
	CLC
	RTS
.test05_fail
	LDY	#0
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 06: Clock Pulse
\ Verifies that i2clock (sclhi then scllo) completes without error.
\-------------------------------------------------------------------------------
.test06_clock_pulse
	scllo
	i2clock
	CLC
	RTS

\-------------------------------------------------------------------------------
\ Test 07: START-STOP Sequence
\ Verifies idle → START (SDA low) → STOP (SDA high) in one sequence.
\ Y on failure: 1 = idle, 2 = START, 3 = STOP.
\-------------------------------------------------------------------------------
.test07_start_stop
	i2cidle
	i2creadm
	BNE	test07_ok1
	JMP	test07_fail_1
.test07_ok1
	i2cstartm
	i2creadm
	BEQ	test07_ok2
	JMP	test07_fail_2
.test07_ok2
	i2cstopm
	i2creadm
	BNE	test07_done
	JMP	test07_fail_3
.test07_done
	CLC
	RTS
.test07_fail_1
	LDY	#1
	JMP	test07_fail
.test07_fail_2
	LDY	#2
	JMP	test07_fail
.test07_fail_3
	LDY	#3
.test07_fail
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 08: Address Transmission
\ Transmits a 7-bit address with RnW via i2caddr, then checks i2crxack.
\ Step 1: RTC write — expect ACK (device on bus). Step 2: $80 — expect NACK.
\ Y on failure: 1 = step 1, 2 = step 2.
\-------------------------------------------------------------------------------
.test08_addr_tx
	JSR	i2cstart
	LDA	#RTC
	CLC
	JSR	i2caddr
	JSR	i2crxack
	BCC	test08_ok1
	JMP	test08_fail_1
.test08_ok1
	JSR	i2cstart
	LDA	#$80
	CLC
	JSR	i2caddr
	JSR	i2crxack
	BCS	test08_done
	JMP	test08_fail_2
.test08_done
	CLC
	RTS
.test08_fail_1
	LDY	#1
	JMP	test08_fail
.test08_fail_2
	LDY	#2
.test08_fail
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 09: Byte Write
\ Writes TESTPAT to PCF8583 NVRAM register USERNV (&80, safe user byte).
\ Device RTC (&50) on AP6. Run before test 10 on hardware.
\ Y on failure: 1 = addr, 2 = reg ACK, 3 = data ACK.
\-------------------------------------------------------------------------------
.test09_byte_write
	JSR	i2cstart
	LDA	#RTC
	CLC
	JSR	i2caddr
	JSR	i2crxack
	BCC	test09_ok1
	JMP	test09_fail_1
.test09_ok1
	LDA	#USERNV
	JSR	i2ctxbyte
	JSR	i2crxack
	BCC	test09_ok2
	JMP	test09_fail_2
.test09_ok2
	LDA	#TESTPAT
	JSR	i2ctxbyte
	JSR	i2crxack
	BCC	test09_done
	JMP	test09_fail_3
.test09_done
	JSR	i2cstop
	CLC
	RTS
.test09_fail_1
	LDY	#1
	JMP	test09_fail
.test09_fail_2
	LDY	#2
	JMP	test09_fail
.test09_fail_3
	LDY	#3
.test09_fail
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 10: Byte Read
\ Reads USERNV back and compares with TESTPAT (requires test 09 on hardware).
\ Y on failure: 1 = addr W, 2 = reg ACK, 3 = addr R, 4 = data mismatch.
\-------------------------------------------------------------------------------
.test10_byte_read
	JSR	i2cstart
	LDA	#RTC
	CLC
	JSR	i2caddr
	JSR	i2crxack
	BCC	test10_ok1
	JMP	test10_fail_1
.test10_ok1
	LDA	#USERNV
	JSR	i2ctxbyte
	JSR	i2crxack
	BCC	test10_ok2
	JMP	test10_fail_2
.test10_ok2
	JSR	i2cstart
	LDA	#RTC
	SEC
	JSR	i2caddr
	JSR	i2crxack
	BCC	test10_ok3
	JMP	test10_fail_3
.test10_ok3
	JSR	i2crxbyte
	STA	comdata
	CLC
	JSR	i2ctxack
	JSR	i2cstop
	LDA	comdata
	CMP	#TESTPAT
	BEQ	test10_done
	JMP	test10_fail_4
.test10_done
	CLC
	RTS
.test10_fail_1
	LDY	#1
	JMP	test10_fail
.test10_fail_2
	LDY	#2
	JMP	test10_fail
.test10_fail_3
	LDY	#3
	JMP	test10_fail
.test10_fail_4
	LDY	#4
.test10_fail
	SEC
	RTS

\-------------------------------------------------------------------------------
\ Test 11: Address Transmission (continuous)
\ Copy of test 08, repeated forever for soak / scope. *I2CTEST 11 only —
\ not part of the default suite (lives after the first $FF in testtab).
\-------------------------------------------------------------------------------
.test11_addr_tx_loop
.t11_loop
	JSR	i2cstart
	LDA	#RTC
	CLC
	JSR	i2caddr
	JSR	i2crxack
	BCC	t11_ok1
	JMP	t11_loop
.t11_ok1
	JSR	i2cstart
	LDA	#$80
	CLC
	JSR	i2caddr
	JSR	i2crxack
	JMP	t11_loop

\-------------------------------------------------------------------------------
\ Test runner: walk testtab, print description, run handler, show Pass/Fail.
\ testsel=0 runs suite until first $FF; testsel=N runs only test N (scans past
\ $FF separators so numbered extras like 11 are reachable).
\ Re-inits ap6regc before each test; runner ZP at &70–&77 avoids MOS OSASCI scratch.
\ runtests_default clears testsel (EXEC / *RUN entry). ROM *I2CTEST sets testsel
\ then JSRs runtests.
\-------------------------------------------------------------------------------
.runtests_default
	LDA	#0
	STA	testsel
.runtests
	LDA	#LO(testtab)
	STA	testptrl
	LDA	#HI(testtab)
	STA	testptrh
	LDA	testsel
	BNE	run_selected
	LDY	#0
.testloop
	LDA	(testptrl),Y
	CMP	#$FF
	BNE	test_not_done
	RTS
.test_not_done
	JSR	run_current
	JMP	testloop

\-------------------------------------------------------------------------------
\ Find 1-based testsel in testtab (skipping $FF section markers) and run it.
\-------------------------------------------------------------------------------
.run_selected
	LDA	#0
	STA	comdata
.find_loop
	LDY	#0
	LDA	(testptrl),Y
	CMP	#$FF
	BNE	find_entry
	INC	testptrl
	BNE	find_ff_ok
	INC	testptrh
.find_ff_ok
	LDA	(testptrl),Y
	CMP	#$FF
	BNE	find_entry
	JMP	test_bad
.find_entry
	INC	comdata
	LDA	comdata
	CMP	testsel
	BEQ	find_run
	JSR	skip_entry
	JMP	find_loop
.find_run
	JSR	run_current
	RTS

\-------------------------------------------------------------------------------
\ Print description at testptr, call handler, print Pass/Fail + newline.
\ Leaves testptr on the next table entry. Clobbers X/Y; preserves C from handler
\ only transiently.
\-------------------------------------------------------------------------------
.run_current
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
	INC	testptrl
	BNE	desc_skip_done
	INC	testptrh
.desc_skip_done
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
	TXA
	PHA
	LDA	#AP6IDLE
	JSR	ap6poke
	JSR	calltest
	PLA
	TAX
	BCS	testfailed
	JSR	printspaces
	JSR	printsuccess
	JMP	test_result_done
.testfailed
	JSR	printspaces
	JSR	printfail
.test_result_done
	JSR	OSNEWL
	RTS

\-------------------------------------------------------------------------------
\ Advance testptr past one table entry (description + handler address).
\-------------------------------------------------------------------------------
.skip_entry
.skip_desc
	LDY	#0
	LDA	(testptrl),Y
	BEQ	skip_desc_done
	INC	testptrl
	BNE	skip_desc
	INC	testptrh
	BNE	skip_desc
.skip_desc_done
	INC	testptrl
	BNE	skip_addr_lo
	INC	testptrh
.skip_addr_lo
	INC	testptrl
	BNE	skip_addr_hi
	INC	testptrh
.skip_addr_hi
	INC	testptrl
	BNE	skip_entry_done
	INC	testptrh
.skip_entry_done
	RTS

\-------------------------------------------------------------------------------
\ Unknown test number / bad parameter.
\-------------------------------------------------------------------------------
.test_bad
	LDX	#0
.bad_loop
	LDA	badmsg,X
	BEQ	bad_done
	JSR	OSASCI
	INX
	BNE	bad_loop
.bad_done
	JSR	OSNEWL
	RTS
.badmsg	EQUS	"Bad", 0

\-------------------------------------------------------------------------------
\ Call test handler via indirect jump (temp1/temp2 hold address).
\-------------------------------------------------------------------------------
.calltest
	JMP	(temp1)

\-------------------------------------------------------------------------------
\ Pad description to column 30 before Pass/Fail (X = description length).
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
\ Print "Pass" after a successful test.
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
\ Print "Fail" and optional step number from Y (0 = omit number).
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
	TYA
	BEQ	faildone
	LDA	#' '
	JSR	OSASCI
	TYA
	CLC
	ADC	#$30
	JSR	OSASCI
.faildone
	RTS
.failmsg	EQUS	"Fail", 0

\-------------------------------------------------------------------------------
\ Initialise ap6regc and sync &FCD6. Call with A = AP6IDLE.
\-------------------------------------------------------------------------------
.ap6poke
	STA	ap6regc
	STA	AP6REG
	NOP
	RTS

\-------------------------------------------------------------------------------
\ Subroutine wrapper for i2cstartm (JSR target for tests and mocking).
\-------------------------------------------------------------------------------
.i2cstart
	i2cstartm
	RTS

\-------------------------------------------------------------------------------
\ Subroutine wrapper for i2cstopm.
\-------------------------------------------------------------------------------
.i2cstop
	i2cstopm
	RTS

\-------------------------------------------------------------------------------
\ Transmit 7-bit address in A plus RnW in Carry (0 = write, 1 = read).
\-------------------------------------------------------------------------------
.i2caddr
	STA	addrbyte
	TXA
	PHA
	TYA
	PHA
	LDA	addrbyte
	PHP
	ASL	A
	LDY	#7
.adloop
	ASL	A
	TAX
	i2cdbit
	i2clock
	TXA
	DEY
	BNE	adloop
	PLP
	i2cdbit
	i2clock
	PLA
	TAY
	PLA
	TAX
	RTS

\-------------------------------------------------------------------------------
\ Sample slave ACK after address: Carry clear = ACK, Carry set = NACK.
\-------------------------------------------------------------------------------
.i2crxack
	sclhi
	sdahi
	i2creadm
	CLC
	BEQ	rxax
	SEC
.rxax
	scllo
	RTS

\-------------------------------------------------------------------------------
\ Master ACK/NACK after read (Carry clear = ACK, set = NACK).
\-------------------------------------------------------------------------------
.i2ctxack
	i2cdbit
	i2clock
	RTS

\-------------------------------------------------------------------------------
\ Receive one 8-bit byte from slave; returns byte in A.
\-------------------------------------------------------------------------------
.i2crxbyte
	TXA
	PHA
	TYA
	PHA
	scllo
	sdahi
	LDX	#0
	LDY	#8
.rxloop
	sclhi
	i2creadm
	CLC
	BEQ	rxby1
	SEC
.rxby1
	TXA
	ROL	A
	TAX
	scllo
	DEY
	BNE	rxloop
	STX	comdata
	PLA
	TAY
	PLA
	TAX
	LDA	comdata
	RTS

\-------------------------------------------------------------------------------
\ Transmit one 8-bit byte to slave; byte passed in A.
\-------------------------------------------------------------------------------
.i2ctxbyte
	STA	addrbyte
	TXA
	PHA
	TYA
	PHA
	LDA	addrbyte
	LDY	#8
	TAX
.txloop
	TXA
	ASL	A
	TAX
	i2cdbit
	i2clock
	DEY
	BNE	txloop
	PLA
	TAY
	PLA
	TAX
	RTS

.endtests

IF TARGET=2

SAVE "I2CT", start, endtests, runtests_default, start

ENDIF

IF TARGET=1

\-------------------------------------------------------------------------------
\ ROM service entry: service 4 (*I2CTEST [n] command) only; others RTS.
\-------------------------------------------------------------------------------
.service
	CMP	#4
	BNE	serv_x
	JMP	command
.serv_x
	RTS

.cmdname
	EQUS	"I2CTEST", 0

\-------------------------------------------------------------------------------
\ Match *I2CTEST on the MOS command line; optional decimal test number.
\-------------------------------------------------------------------------------
.command
	TXA
	PHA
	DEY
	TYA
	PHA
	LDX	#0
.cmd_match
	INY
	LDA	(&F2),Y
	CMP	#'A'
	BMI	cmd_upper
	AND	#&DF
.cmd_upper
	CMP	cmdname,X
	BNE	cmd_notours
	INX
	LDA	cmdname,X
	BNE	cmd_match
	LDA	#0
	STA	testsel
	INY
	LDA	(&F2),Y
	CMP	#13
	BEQ	cmd_run
	CMP	#32
	BEQ	cmd_skip_sp
	BNE	cmd_notours
.cmd_skip_sp
	INY
	LDA	(&F2),Y
	CMP	#32
	BEQ	cmd_skip_sp
	CMP	#13
	BEQ	cmd_run
.cmd_parse
	CMP	#'0'
	BCC	cmd_bad
	CMP	#'9'+1
	BCS	cmd_bad
	AND	#&0F
	STA	temp1
	LDA	testsel
	ASL	A
	STA	temp2
	ASL	A
	ASL	A
	CLC
	ADC	temp2
	ADC	temp1
	STA	testsel
	INY
	LDA	(&F2),Y
	CMP	#13
	BEQ	cmd_run
	CMP	#32
	BNE	cmd_parse
.cmd_run
	JSR	runtests
	PLA
	TAY
	PLA
	TAX
	LDA	#0
	RTS
.cmd_bad
	JSR	test_bad
	PLA
	TAY
	PLA
	TAX
	LDA	#0
	RTS
.cmd_notours
	PLA
	TAY
	INY
	PLA
	TAX
	LDA	#4
	RTS

.romend

SAVE "I2CTROM", start, romend

ENDIF
