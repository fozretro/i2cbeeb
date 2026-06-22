REM > RTCRead 1.00
REM Test reading RTC via OSWORD 14 API calls
:
MODE &80
DIM ctrl% 31:X%=ctrl%:Y%=X%DIV256:OSWORD=&FFF1
:
REM Test OSWORD 14 calls
REM --------------------
PROCosw14_0(0):PROCspc
PROCosw14_1(1):PROCspc
PROCosw14_2(2):PROCspc
PROCosw14_3(3):PROCspc
PROCosw14_4(4):PROCspc
PROCosw14_X(5):PROCspc
PROCosw14_X(6):PROCspc
PROCosw14_X(7):PROCspc
PROCosw14_0(8):PROCspc
PROCosw14_1(9):PROCspc
PROCosw14_2(10):PROCspc
PROCosw14_3(11):PROCspc
PROCosw14_X(12):PROCspc
PROCosw14_X(13):PROCspc
PROCosw14_X(14):PROCspc
PROCosw14_X(15):PROCspc
END
:
DEFPROCosw14_0(sub%)
PRINT"OSWORD 14,";sub%;": Read RTC as string"
!X%=sub%:PROCcall:IF !X%=sub%:PRINT"No response":ENDPROC
PROCstring:ENDPROC
:
DEFPROCosw14_1(sub%)
PRINT"OSWORD 14,";sub%;": Read RTC as ";7+sub%DIV8;"-byte BCD"
!X%=sub%:PROCcall:IF !X%=sub%:PRINT"No response":ENDPROC
PROCbcd:ENDPROC
:
DEFPROCosw14_2(sub%)
PRINT"OSWORD 14,";sub%;": Convert ";7+sub%DIV8;"-byte BCD to string"
X%!1=&03072620:X%!5=&30551606:IF sub%<8:X%!1=X%!2:X%!5=X%!6:REM It's friday, it's five to five
?X%=sub%:PROCcall:IF ?X%=sub%:PRINT"No response":ENDPROC
PROCstring:ENDPROC
:
DEFPROCosw14_3(sub%)
PRINT"OSWORD 14,";sub%;": Read 5-byte time";LEFT$(" or string from server",sub%<8)
!X%=sub%:X%!5=0:PROCcall:IF !X%=sub%:PRINT"No response":ENDPROC
IF X%!5=0:PROCdump:PRINT"Appears to return 5-byte time":ENDPROC
X%?24=13:A$=$X%:PRINTA$'"Appears to be string":PROCstring1:ENDPROC
:
DEFPROCosw14_4(sub%)
PRINT"OSWORD 14,";sub%;": Read 7-byte BCD from server"
!X%=sub%:X%!5=0:PROCcall:IF !X%=sub%:PRINT"No response":ENDPROC
IF X%!5=0:PROCdump:PRINT"Appears to return BCD time":PROCbcd1:ENDPROC
X%?24=13:A$=$X%:PRINTA$'"Appears to be string":PROCstring1:ENDPROC
:
DEFPROCosw14_X(sub%)
PRINT"OSWORD 14,";sub%;": Subcall ";sub%
!X%=sub%:PROCcall:IF !X%=sub%:PRINT"No response":ENDPROC
PROCdump:ENDPROC
:
DEFPROCcall:A%=14:CALL OSWORD:PRINT"Returned:  ";:ENDPROC
:
DEFPROCstring:X%?24=13:A$=$X%:PRINTA$
DEFPROCstring1
IF FNchk(MID$(A$,5,2)) :PRINT"Date malformed, should be '01'-'31'"
month%=INSTR("JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC",FNuc(MID$(A$,8,3)))
IF ((month%-1) MOD 3)<>0:PRINT"Month malformed, should be 'Jan'-'Dec'"
IF FNchk(MID$(A$,14,2)):PRINT"Year malformed, should be '00'-'99'"
IF FNchk(MID$(A$,12,2)):PRINT"Century malformed, should be '00'-'99'"
IF FNchk(MID$(A$,17,2)):PRINT"Hour malformed, should be '00'-'23'"
IF FNchk(MID$(A$,20,2)):PRINT"Minutes malformed, should be '00'-'59'"
IF FNchk(MID$(A$,23,2)):PRINT"Seconds malformed, should be '00'-'60'"
day%=INSTR("SUNMONTUEWEDTHUFRISAT",FNuc(MID$(A$,1,3)))
IF ((day%-1) MOD 3)<>0:PRINT"Day malformed or not supported, should be 'Sun'-'Sat'"
PRINT"DayOfWeek: ";day%DIV3+1
PRINT"Date:      ";VALMID$(A$,5,2)
PRINT"Month:     ";month%DIV3+1
PRINT"Year:      ";VALMID$(A$,12,4)
PRINT"Hour:      ";VALMID$(A$,17,2)
PRINT"Minute:    ";VALMID$(A$,20,2)
PRINT"Seconds:   ";VALMID$(A$,23,2)
ENDPROC
:
DEFPROCbcd:PROCdump
DEFPROCbcd1
A%=X%+sub%DIV8
IF (sub%AND8):IF FNbcd(?X%)         :PRINT"Century malformed, should be &00-&99"
IF FNbcd(A%?0)                      :PRINT"Year malformed, should be &00-&99"
IF FNbcd(A%?1) OR A%?1=0 OR A%?1>&12:PRINT"Month malformed, should be &01-&12"
IF FNbcd(A%?2) OR A%?2=0 OR A%?2>&31:PRINT"Date malformed, should be &01-&31"
IF FNbcd(A%?4) OR A%?4>&59          :PRINT"Hour malformed, should be &00-&59"
IF FNbcd(A%?5) OR A%?5>&59          :PRINT"Minute malformed, should be &00-&59"
IF FNbcd(A%?6) OR A%?6>&60          :PRINT"Second malformed, should be &00-&60"
PRINT"DayOfWeek: ";:IF A%?3=0:PRINT "not returned" ELSE PRINT;A%?3
PRINT"Date:      ";~A%?2
PRINT"Month:     ";~A%?1
PRINT"Year:      ";~A%?0
PRINT"Century:   ";:IF sub%<8:PRINT;19-(A%?0<&80) ELSE PRINT;~X%?0
PRINT"Hour:      ";~A%?4
PRINT"Minute:    ";~A%?5
PRINT"Seconds:   ";~A%?6
ENDPROC
:
DEFPROCdump:FOR A%=0 TO 7:PRINT FNh0(X%?A%,2);" ";:NEXT:PRINT:ENDPROC
:
DEFFNchk(S$)
IF LEFT$(S$,1)<"0" OR LEFT$(S$,1)>"9":=TRUE
IF RIGHT$(S$,1)<"0" OR RIGHT$(S$,1)>"9":=TRUE
=FALSE
:
DEFFNbcd(A%)=(A% AND 15)>9 OR A%>&9F
:
DEFFNuc(A$):LOCAL B$:IFA$="":=""
REPEATB$=B$+CHR$(ASCA$AND((A$<"@")OR&DF)):A$=MID$(A$,2):UNTILA$="":=B$
DEFFNh0(A%,N%)=RIGHT$("0000000"+STR$~A%,N%)
DEFPROCspc:PRINT"Press SPACE";:A%=GET:PRINTCHR$13;SPC12:ENDPROC
