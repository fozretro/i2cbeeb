REM ***************************
REM Test 01 : Check for PCF8583
REM ***************************
*I2CQUERY Q
PRINT "Test 01 : ";
IF ?&A00=&50 THEN PRINT "Pass" ELSE PRINT "Fail"

REM **************************
REM Test 02 : Byte W/R
REM Uses PCF8583 register 0x80 (128) = NVRAM address 110 (safe, above used range 0-16)
REM **************************
PRINT "Test 02 : ";
A%=42
B%=0
*I2CTXB 50 #80 A%
*I2CRXB 50 #80 B%
IF A%=B% THEN PRINT "Pass" ELSE PRINT "Fail"

REM **************************
REM Test 03 : Bytes W/R
REM Uses PCF8583 register 0x80 (128) = NVRAM address 110 (safe, above used range 0-16)
REM **************************
PRINT "Test 03 : ";
$&A00="HELLO"
*I2CTXD 50 #80 06
*I2CRXD 50 #80 06
IF $&A00="HELLO" THEN PRINT "Pass" ELSE PRINT "Fail"

REM **************************
REM Test 04 : Passage of time
REM **************************
PRINT "Test 04 : ";
I%=5:O%=255:REPEAT
?&900=1
A%=14:X%=0:Y%=&09:CALL &FFF1
T%=( (?&906 DIV 16) AND &F ) *10 + (?&906 AND &F)
IF T%=O% THEN PRINT "Fail":EXIT
O%=T%
S%=TIME+100:REPEAT UNTIL TIME>S%
I%=I%-1:UNTIL I%=0
IF I%=0 THEN PRINT "Pass"

REM **************************
REM Test 05 : OSBYTE NVRAM Write
REM **************************
PRINT "Test 05 : ";
TESTADDR%=200
TESTVAL%=170
REM Write test value to NVRAM address 200 via OSBYTE
A%=&A2:X%=TESTADDR%:Y%=TESTVAL%:CALL &FFF4
REM Verify write via direct I2C read (reg &DA = 0x12 + 200)
A%=0
*I2CRXB 50 #DA A%
IF A%=TESTVAL% THEN PRINT "Pass" ELSE PRINT "Fail: Wrote ";TESTVAL%;" Read ";A%

REM **************************
REM Test 06 : OSBYTE NVRAM Read
REM **************************
PRINT "Test 06 : ";
TESTADDR%=200
TESTVAL%=150
REM Ensure value is written first
A%=&A2:X%=TESTADDR%:Y%=TESTVAL%:CALL &FFF4
REM Read via OSBYTE using USR to decode return values
A%=&A1:X%=TESTADDR%:Y%=0
U%=USR(&FFF4)
Y%=(U% AND &FF0000) DIV &10000
IF Y%=TESTVAL% THEN PRINT "Pass" ELSE PRINT "Fail: Exp ";TESTVAL%;" Got ";Y%

REM **************************
REM Test 07 : OSBYTE NVRAM Read (Assembler)
REM **************************
PRINT "Test 07 : ";
TESTADDR%=200
TESTVAL%=170
REM Ensure value is written first
A%=&A2:X%=TESTADDR%:Y%=TESTVAL%:CALL &FFF4
REM Reserve memory for assembler code
DIM asmcode 20
REM Set program counter to start of code
P%=asmcode
REM Assemble machine code
[ OPT 0
LDA #&A1
LDX #&C8
LDY #0
JSR &FFF4
STY &70
RTS
]
REM Call the assembled code
CALL asmcode
REM Print value from &70
IF ?&70=TESTVAL% THEN PRINT "Pass" ELSE PRINT "Fail: Exp ";TESTVAL%;" Got ";?&70
