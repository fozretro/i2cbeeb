REM > RTCTest 1.10
REM Test OSWORD 14 and 15 clock calls
:
MODE &80
DIM ctrl% 31:X%=ctrl%:Y%=X%DIV256
OSWORD=&FFF1:T$="":?X%=0:A%=14:CALL OSWORD:IF?X%:X%?24=13:T$=$X%
:
REM Test OSWORD 14 calls
REM --------------------
sub%=-1
ON ERROR IF ERR<>163:REPORT:PRINT " at line ";ERL:PROCretime:END ELSE VDU 19,0,0,0:REPORT:PRINT
REPEAT
sub%=sub%+1:num%=1
RESTORE:FOR A%=0 TO sub%:READ A$:NEXT
IF sub%=2 OR sub%=10:num%=4
IF sub%=6 OR sub%=14:num%=3
FOR test%=1 TO num%
!X%=sub%:X%!4=0:X%!8=0
IF sub%=02:IF test%=1:X%!1=&07010180:X%!5=&00332211
IF sub%=02:IF test%=2:X%!1=&06311299:X%!5=&00433221
IF sub%=02:IF test%=3:X%!1=&05010100:X%!5=&00443322
IF sub%=02:IF test%=4:X%!1=&04311279:X%!5=&00544332
IF sub%=10:IF test%=1:X%!1=&31127919:X%!5=&54433221
IF sub%=10:IF test%=2:X%!1=&01018019:X%!5=&44332211
IF sub%=10:IF test%=3:X%!1=&01010020:X%!5=&43322110
IF sub%=10:IF test%=4:X%!1=&31129920:X%!5=&33221100
IF sub%=06:X%!1=test%-1
IF sub%=14:X%!1=test%-1
IF test%=1:PRINT TAB(0);"OSWORD 14,";sub%;":";TAB(14);A$;
IF num%>1:PRINT'TAB(7);:PROCdump(8)
U%=!X%:PRINT TAB(43);"-> ";:A%=14:CALL OSWORD:U%=!X%<>U%
IF U%=0:PRINT"IGNORED";
IF U%:IF INSTR("02348A",STR$~sub%):IF ?X%<>sub%:IF X%?8>31:PRINT """"$X%""""; ELSE IF U%:PROCdump(7)
NEXT
UNTIL sub%>13
A%=GET:CLS
DATA Read clock string,Read 7-byte BCD,Convert 7-byte BCD
DATA Read 5-byte time/Read from ANFS,Read BCD from ANFS/Read temperature
DATA Read BCD timezone,Read BCD alarm,(7)
DATA Read Clock string,Read 8-byte BCD,Convert 8-byte BCD
DATA (11),(12),(13),(14)
:
REM Test OSWORD 15 calls
REM --------------------
num%=0
ON ERROR IF ERR<>163:REPORT:PRINT " at line ";ERL:PROCretime:END ELSE VDU 19,0,0,0:REPORT:PRINT
REPEAT
num%=num%+1:sub%=ASCMID$("CDEGHHIKOTX",num%,1)AND31
READ A$
PRINT TAB(0);"OSWORD 15,";sub%;":";TAB(14);A$;
FOR test%=1 TO 4
O$=FNtime
?X%=sub%:$(X%+1)=STRING$(sub%,"*")
IF sub%=3:IF test%=1:X%!1=&443322
IF sub%=3:IF test%=2:X%!1=&433221
IF sub%=3:IF test%=3:X%!1=&332211
IF sub%=3:IF test%=4:X%!1=&322110
IF sub%=4:IF test%=1:X%!1=&31129920
IF sub%=4:IF test%=2:X%!1=&01010020
IF sub%=4:IF test%=3:X%!1=&01018019
IF sub%=4:IF test%=4:X%!1=&31127919
IF sub%=5:IF test%=1:X%!1=&07010180:X%?5=&40
IF sub%=5:IF test%=2:X%!1=&07311299:X%?5=&48
IF sub%=5:IF test%=3:X%!1=&07010100:X%?5=&50
IF sub%=5:IF test%=4:X%!1=&07311279:X%?5=&58
IF sub%=7:IF test%=1:X%!1=&07010180:X%!5=&00443322
IF sub%=7:IF test%=2:X%!1=&07311299:X%!5=&00433221
IF sub%=7:IF test%=3:X%!1=&07010100:X%!5=&00332211
IF sub%=7:IF test%=4:X%!1=&07311279:X%!5=&00322110
IF sub%=8:IF test%=1:X%!1=&31129920:X%!5=&44332204:IF num%=6:$(X%+1)="34:34:45"
IF sub%=8:IF test%=2:X%!1=&01010020:X%!5=&43322103:IF num%=6:$(X%+1)="23:33:44"
IF sub%=8:IF test%=3:X%!1=&01018019:X%!5=&33221102:IF num%=6:$(X%+1)="12:23:34"
IF sub%=8:IF test%=4:X%!1=&31127919:X%!5=&32211001:IF num%=6:$(X%+1)="01:22:33"
IF sub%=11:IF test%=1:$(X%+1)="07 Jan 1979"
IF sub%=11:IF test%=2:$(X%+1)="12 Feb 1980"
IF sub%=11:IF test%=3:$(X%+1)="19 Mar 2000"
IF sub%=11:IF test%=4:$(X%+1)="28 Apr 2099"
IF sub%=15:IF test%=1:$(X%+1)="Mon,27 May 2099"
IF sub%=15:IF test%=2:$(X%+1)="Tue,21 Jun 2000"
IF sub%=15:IF test%=3:$(X%+1)="Wed,14 Jul 1980"
IF sub%=15:IF test%=4:$(X%+1)="Thu,06 Aug 1979"
IF sub%=20:IF test%=1:$(X%+1)="04 Sep 1979.12:23:34"
IF sub%=20:IF test%=2:$(X%+1)="12 Oct 1980.23:34:45"
IF sub%=20:IF test%=3:$(X%+1)="20 Nov 2000.11:22:33"
IF sub%=20:IF test%=4:$(X%+1)="30 Dec 2099.01:12:23"
IF sub%=24:IF test%=1:$(X%+1)="Thu,29 Jan 2099.01:12:23"
IF sub%=24:IF test%=2:$(X%+1)="Fri,23 Feb 2000.11:22:33"
IF sub%=24:IF test%=3:$(X%+1)="Sat,17 Mar 1980.23:34:45"
IF sub%=24:IF test%=4:$(X%+1)="Sun,11 Apr 1979.12:23:34"
PRINT'TAB(7);:IF sub%<8 OR X%?3<32:PROCdump(sub%) ELSE PRINT""""$(X%+1)"""";
PRINT TAB(44);"-> ";:A%=15:U%=((USR OSWORD) AND &FF00)DIV256
A$=FNtime:IF U%=&FF OR LEFT$(A$,22)=LEFT$(O$,22):PRINT"IGNORED"; ELSE PRINTA$;
IF VPOS>25:IF test%=4:A%=GET:CLS
NEXT
UNTIL sub%>23
PRINT:PROCretime
END
DATA Write 3-byte BCD time,Write 4-byte BCD date,Write 5-byte TIME,Write 7-byte BCD
DATA Write 8-byte BCD,Write "hh:mm:ss",Write "TZN+hh:mm"
DATA Write "dy mmm yyyy",Write "DDD.dy mmm yyyy"
DATA Write "dd mmm yyyy.hh:mm:ss",Write "DDD.dd mm yyyy.hh:mm:ss"
DATA ,,,,,,
:
DEFFNtime:?X%=8:A%=14:CALL OSWORD:IF ?X%=8:?X%=0:CALL OSWORD
IF?X%>31:X%?24=13:=$X% ELSE =""
DEFPROCretime:IF T$<>"":?X%=LENT$:$(X%+1)=T$:A%=15:CALL OSWORD:ENDPROC ELSE ENDPROC
DEFPROCdump(N%)
FOR A%=0 TO N%:PRINT"&";FNh0(ctrl%?A%,2);:IF A%<>N%:PRINT",";
NEXT:ENDPROC
DEFFNh0(A%,N%)=RIGHT$("0000000"+STR$~A%,N%)
