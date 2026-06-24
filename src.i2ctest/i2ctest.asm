\ Minimal AP6 I²C test
\
\ Two targets — pass -D TARGET=n:
\   TARGET=1   sideways ROM  → I2CTROM → Command *I2CTEST
\   TARGET=2   program RAM   → I2CT
\
\ Build with BeebAsm
\   beebasm -i i2ctest.asm -D TARGET=1 -o I2CTROM 
\   beebasm -i i2ctest.asm -D TARGET=2 -o I2CT
\
\-------------------------------------------------------------------------------
\ Known behaviour (Electron AP6 / slot 12 / &FCD6):
\   *RUN I2CT works.
\   *I2CTEST with I2CTROM in any sideways slot other than 12 works.
\   *I2CTEST with I2CTROM in slot 12 hangs on test 1 and can corrupt EEPROM.
\-------------------------------------------------------------------------------

OSASCI		=	&FFE3
OSNEWL		=	&FFE7
AP6REG		=	&FCD6
AP6IDLE		=	&11
XSDAHI		=	&80
XSDALO		=	&7F
XSCLHI		=	&40
XSCLLO		=	&BF

RTC		=	&50
USERNV		=	&80
TESTPAT		=	&AA

ap6regc		=	&A8
addrbyte	=	&AA
testptrl	=	&AB
testptrh	=	&AC
temp1		=	&AD
temp2		=	&AE
comdata		=	&AF

\-------------------------------------------------------------------------------
\ AP6 I²C bit-bang macros (&FCD6). ap6regc holds the last value written.
\-------------------------------------------------------------------------------

\-------------------------------------------------------------------------------
\ SCL driven high via AP6 control register.
\-------------------------------------------------------------------------------
MACRO sclhi
	LDA	ap6regc
	ORA	#(XSCLHI)
	STA	ap6regc
	STA	AP6REG
ENDMACRO

\-------------------------------------------------------------------------------
\ SCL driven low via AP6 control register.
\-------------------------------------------------------------------------------
MACRO scllo
	LDA	ap6regc
	AND	#(XSCLLO)
	STA	ap6regc
	STA	AP6REG
ENDMACRO

\-------------------------------------------------------------------------------
\ SDA released high (open-drain idle) via AP6 control register.
\-------------------------------------------------------------------------------
MACRO sdahi
	LDA	ap6regc
	ORA	#(XSDAHI)
	STA	ap6regc
	STA	AP6REG
ENDMACRO

\-------------------------------------------------------------------------------
\ SDA driven low via AP6 control register.
\-------------------------------------------------------------------------------
MACRO sdalo
	LDA	ap6regc
	AND	#(XSDALO)
	STA	ap6regc
	STA	AP6REG
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
	STA	AP6REG
	STA	ap6regc
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
\ Test runner: walk testtab, print description, run handler, show Pass/Fail.
\ Re-inits ap6regc before each test (MOS may clobber &A8–&AF during OSASCI).
\-------------------------------------------------------------------------------
.runtests
	LDA	#LO(testtab)
	STA	testptrl
	LDA	#HI(testtab)
	STA	testptrh
	LDY	#0
.testloop
	LDA	(testptrl),Y
	CMP	#$FF
	BNE	test_not_done
	JMP	testsdone
.test_not_done
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
	STA	ap6regc
	JSR	calltest
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

SAVE "I2CT", start, endtests, runtests, start

ENDIF

IF TARGET=1

\-------------------------------------------------------------------------------
\ ROM service entry: service 4 (*I2CTEST command) only; others RTS.
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
\ Match *I2CTEST on the MOS command line; run tests if matched.
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
	INY
	LDA	(&F2),Y
	CMP	#13
	BEQ	cmd_run
	CMP	#32
	BEQ	cmd_run
	BNE	cmd_notours
.cmd_run
	JSR	runtests
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
