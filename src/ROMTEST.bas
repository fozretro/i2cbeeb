REM **************************
REM ROMTEST : *UNPLUG/*INSERT NVRAM Persistence Test
REM Tests ROM Manager's *UNPLUG and *INSERT commands
REM Verifies NVRAM persistence via OSBYTE 161/162
REM Tests ROM 6 (NVRAM address 6, bit 6) and ROM 12 (NVRAM address 7, bit 4)
REM **************************
PRINT "ROMTEST : Testing *UNPLUG/*INSERT NVRAM Persistence"
PRINT ""
REM Read initial NVRAM values for ROM bitmaps
PRINT "Reading initial NVRAM values..."
A%=&A1:X%=6:Y%=0
U%=USR(&FFF4)
ROM07%=(U% AND &FF0000) DIV &10000
A%=&A1:X%=7:Y%=0
U%=USR(&FFF4)
ROM8F%=(U% AND &FF0000) DIV &10000
PRINT "Address 6 (ROMs 0-7): ";~ROM07%
PRINT "Address 7 (ROMs 8-15): ";~ROM8F%
PRINT ""
REM Test ROM 6 (address 6, bit 6)
PRINT "Test 1: ROM 6 (NVRAM address 6, bit 6)"
PRINT "  *UNPLUG 6 - bit 6 should be cleared..."
*UNPLUG 6
A%=&A1:X%=6:Y%=0
U%=USR(&FFF4)
VAL6%=(U% AND &FF0000) DIV &10000
PRINT "    NVRAM address 6 = ";~VAL6%
IF (VAL6% AND &40)=0 THEN 
  PASS6%=TRUE
  PRINT "    PASS: Bit 6 cleared"
ELSE 
  PASS6%=FALSE
  PRINT "    FAIL: Bit 6 not cleared"
ENDIF
PRINT "  *INSERT 6 - bit 6 should be set..."
*INSERT 6
A%=&A1:X%=6:Y%=0
U%=USR(&FFF4)
VAL6%=(U% AND &FF0000) DIV &10000
PRINT "    NVRAM address 6 = ";~VAL6%
IF (VAL6% AND &40)<>0 AND PASS6% THEN 
  PASS6%=TRUE
  PRINT "    PASS: Bit 6 set"
ELSE 
  PASS6%=FALSE
  PRINT "    FAIL: Bit 6 not set correctly"
ENDIF
PRINT ""
REM Test ROM 12 (address 7, bit 4, since 12-8=4)
PRINT "Test 2: ROM 12 (NVRAM address 7, bit 4)"
PRINT "  *UNPLUG 12 - bit 4 should be cleared..."
*UNPLUG 12
A%=&A1:X%=7:Y%=0
U%=USR(&FFF4)
VAL7%=(U% AND &FF0000) DIV &10000
PRINT "    NVRAM address 7 = ";~VAL7%
IF (VAL7% AND &10)=0 THEN 
  PASS12%=TRUE
  PRINT "    PASS: Bit 4 cleared"
ELSE 
  PASS12%=FALSE
  PRINT "    FAIL: Bit 4 not cleared"
ENDIF
PRINT "  *INSERT 12 - bit 4 should be set..."
*INSERT 12
A%=&A1:X%=7:Y%=0
U%=USR(&FFF4)
VAL7%=(U% AND &FF0000) DIV &10000
PRINT "    NVRAM address 7 = ";~VAL7%
IF (VAL7% AND &10)<>0 AND PASS12% THEN 
  PASS12%=TRUE
  PRINT "    PASS: Bit 4 set"
ELSE 
  PASS12%=FALSE
  PRINT "    FAIL: Bit 4 not set correctly"
ENDIF
PRINT ""
PRINT "Overall Result: ";
IF PASS6% AND PASS12% THEN 
  PRINT "PASS - All tests passed"
ELSE 
  PRINT "FAIL - ROM6=";PASS6%;" ROM12=";PASS12%
ENDIF
