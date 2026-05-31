REM > NVList 1.30
REM J.G.Harston 09-Feb-2025
REM Display NVRAM contents via API
REM Based on Ian Wolstenholme's RTCTest
MODE128:DIMctrl%31,nv%255:X%=ctrl%:Y%=X%DIV256
DIMbaud$(7):FORB%=0TO7:READbaud$(B%):NEXT
DIMprinter$(4):FORB%=0TO4:READprinter$(B%):NEXT
R$="Press a key to return to menu"
P$="Press a key to continue":V$="1.30"
ONERRORREPORT:IFERR<>17:PRINT" at ";ERL;FNinv(FALSE):VDU23,1,1;0;0;0;0;:OSCLI"FX4,0":END
REPEAT:X%=ctrl%:Y%=X%DIV256:CLS:VDU23,1;0;0;0;0;
PRINTFNinv(TRUE)"NVRAM Settings v"V$;FNinv(FALSE)'
PRINT"1. Show NVRAM settings"
PRINT"2. Show NVRAM data"
PRINT'"0. Exit"
REPEATK%=GET:UNTILK%>47ANDK%<51
IFK%=49PROCnvshow
IFK%=50PROCnvdump
UNTILK%=48:VDU23,1,1;0;0;0;0;
END
DATA 75,150,300,1200,2400,4800,9600,19200
DATA No printer,Parallel,Serial,User,Econet
DEFFNo(A%):IFA%:="On"ELSE="Off"
DEFFNh(A%)=RIGHT$("0"+STR$~A%,2)
DEFFNif(A%,A$,B$):IFA%:=A$ELSE=B$
DEFFNc(A%):A%=A%AND127:IFA%<32ORA%=127:="."ELSE=CHR$A%
DEFFNinv(A%):COLOUR128+(A%AND7):COLOUR7-(A%AND7):=""
DEFFNtime:A%=14:!X%=0:CALL&FFF1:IF!X%:X%?24=13:=$X%ELSE=""
DEFFNnv(A%):=RIGHT$("  "+STR$A%,LENSTR$nvmax%)+": "+FNh(nv%?A%)+STRING$(4-LENSTR$nvmax%," ")
DEFPROCreadall:LOCALX%,Y%:A%=161:FORX%=255TO0STEP-1:Y%=0:Y%=USR&FFF4
nv%?X%=(Y%AND&FF0000)DIV65536:NEXT:nvoff%=(Y%AND&FF00)DIV256
X%=255:Y%=49:A%=USR&FFF4:nvmax%=(A%AND&FF0000)DIV65536:IFnvmax%<2:nvmax%=255
ENDPROC
DEFPROCnvshow:CLS:PRINTFNinv(TRUE)"NVRAM Settings"FNinv(FALSE);:PROCreadall
PRINTSPC6"Total NVRAM locations: ";nvmax%+1
PRINTFNnv(0)"Station Number:"TAB(28);?nv%
PRINTFNnv(1)"File server:"TAB(28);nv%?2".";nv%?1'FNnv(2)
PRINTFNnv(3)"Printer server:"TAB(28);nv%?4".";nv%?3'FNnv(4)
PRINTFNnv(5)"Filing system:"TAB(28);:A%=nv%?5AND15:PRINT;A%TAB(31)FNrom(A%)
PRINTTAB(8)"Language:"TAB(28);:A%=nv%?5DIV16:PRINT;A%TAB(31)FNrom(A%)
PRINTFNnv(6);:PROCplug(nv%?6,0):PRINTFNnv(7);:PROCplug(nv%?7,8)
PRINTFNnv(8)"EDIT settings:"TAB(28)"MODE "MID$("01K34D67",1+(nv%?8AND7),1);
PRINT", TAB to "FNif(nv%?8AND8,"Words","Columns");
PRINT", "FNif(nv%?8AND16,"Insert","Overwrite");
PRINT", "FNif(nv%?8AND32,"Show","Hide");
PRINT" Returns"
REM PRINTTAB(8)"Century:"TAB(28);(nv%?8)DIV64+19
PRINTFNnv(9)"Telecoms settings:"TAB(28);nv%?9
PRINTFNnv(10)"Screen settings:"TAB(28)"MODE ";(nv%?10AND8)*16+(nv%?10AND7)", TV ";:A%=(nv%?10AND&E0)DIV32:IFA%>3:A%=A%+248
PRINT;A%",";(nv%?10AND16)DIV16;" (Interlace "FNo(nv%?10AND16)")"
PRINTFNnv(11)"Floppy timing:"TAB(28);nv%?11AND7'TAB(8)"Keyboard:"TAB(28);
IFnv%?11AND8PRINT"SHIFT-CAPS "ELSE IFnv%?11AND16PRINT"No CAPS "ELSE IFnv%?11AND32PRINT"CAPS Lock "
PRINTTAB(8)"ADFS:"TAB(28)FNif(nv%?11AND64,"No d","D");
PRINT"irectory, "FNif(nv%?11AND128,"Floppy","Hard Drive")
PRINTFNnv(12)"Key repeat delay:"TAB(28);nv%?12
PRINTFNnv(13)"Key repeat rate:"TAB(28);nv%?13
PRINTFNnv(14)"Printer ignore:"TAB(28);nv%?14
PRINTFNnv(15)"Tube:"TAB(28)FNif(nv%?15AND1,"En","Dis")"abled"
PRINTTAB(8)"Printer ignore:"TAB(28)FNif(nv%?15AND2,"Not i","I")"gnored"
PRINTTAB(8)"Serial baud rate:"TAB(28);:A%=(nv%?15AND&1C)DIV4:PRINT;A%+1;" (";baud$(A%);")"
PRINTTAB(8)"Printer type:"TAB(28);:A%=(nv%?15AND&E0)DIV32:PRINT;A%;:IFA%<5PRINT" ("printer$(A%)")";
PRINT'FNnv(16)"Shadow screen:"TAB(28)FNif(nv%?16AND1,"F","Don't f")"orce shadow"
PRINTTAB(8)"Beep:"TAB(28)FNif(nv%?16AND2,"Loud","Quiet")
PRINTTAB(8)"Second processor:"TAB(28)FNif(nv%?16AND4,"Ex","In")"ternal"
PRINTTAB(8)"Screen scroll:"TAB(28)FNif(nv%?16AND8,"No s","S")"croll"
PRINTTAB(8)"Autoboot:"TAB(28)FNif(nv%?16AND16,"B","No b")"oot"
PRINTTAB(8)"Serial data:"TAB(28);(nv%?16AND&E0)DIV32;TAB(50);
PROCwait(P$):CLS:PRINTFNinv(TRUE)"NVRAM Settings"FNinv(FALSE)SPC6"Total NVRAM locations: ";nvmax%+1
PRINTFNnv(17)"ANFS settings:"TAB(28)FNif(nv%?17AND1,"S","No s")"pace"
PRINTTAB(8)"FindLib:"TAB(28)FNo(nv%?17AND2)
PRINTTAB(8)"Workspace:"TAB(28)FNif(nv%?17AND4,"&0Exx/0Fxx","&0Bxx/0Cxx")
PRINTTAB(8)"Spare b3,b4,b5:"TAB(28);(nv%?17AND8)DIV8" ";(nv%?17AND16)DIV16" ";(nv%?17AND32)DIV32
PRINTTAB(8)"Protection:"TAB(28)FNo(nv%?17AND64)
PRINTTAB(8)"Display version:"TAB(28)FNo(nv%?17AND128)
PRINTFNnv(18)"Joystick settings:"TAB(28)"Speed:"SPC4;nv%?18AND15
PRINTTAB(28)"Spare b4: ";(nv%?18AND16)DIV16
PRINTTAB(28)FNif(nv%?18AND32,"Switched &0000/","Proportional &0000...")"&FFFF"
IFnv%?18<128:PRINTTAB(28)"Convert to "FNif(nv%?18AND64,"cursor keypresses","ADVAL values")
IFnv%?18>127:PRINTTAB(28)"Service Call &2C, b6 flag: ";(nv%?18AND64)DIV64
PRINTTAB(28)FNif(nv%?18AND128,"Pass to Service Call &2C","Implemented by MOS")
PRINTFNnv(19)"Country:"TAB(28);nv%?19
FORB%=0TO4:PRINTFNnv(B%+20)"System byte ";B%TAB(28)FNnv(B%+25)"System byte ";B%+5:NEXT
FORB%=0TO7:PRINTFNnv(B%+30)"ROM ";B%" byte"TAB(28)FNnv(B%+38)"ROM ";B%+8" byte":NEXT
st%=(nvmax%-45)DIV2:FORB%=46TO45+st%:PRINTFNnv(B%)"User byte ";B%-46TAB(28)FNnv(B%+st%)"User byte ";B%+st%-46
IF(B%AND15)=2:PROCwait(P$):PRINTTAB(0,31);
NEXT:PRINTTAB(50);:PROCwait(R$):ENDPROC
DEFPROCplug(F%,N%):FORB%=0TO7STEP4:FORC%=0TO3:A%=N%+B%+C%
PRINTTAB(8+C%*18)"ROM ";A%SPC(1-(A%<10));FNif(F%AND(2^(B%+C%)),"Inserted","Unplugged");
NEXT:PRINT:NEXT:ENDPROC
DEFPROCnvdump:CLS:PRINTFNinv(TRUE)"NVRAM Dump"FNinv(FALSE):PROCreadall
FORN%=0TO255STEP16:FORM%=N%TON%+15:PRINTFNinv(M%>nvmax%)FNh(nv%?M%)FNinv(FALSE)" ";:NEXT:PRINTSPC2;
FORM%=N%TON%+15:PRINTFNinv(M%>nvmax%)FNc(nv%?M%)FNinv(FALSE);:NEXT:PRINT
NEXT:PRINT'"Total NVRAM locations: ";nvmax%+1'"NVRAM location offset: ";nvoff%':PROCwait(R$):ENDPROC
DEFPROCwait(A$):PRINTA$;:REPEATPRINTTAB(50,0)"Time: ";FNtime:UNTILINKEY(50)<>-1:ENDPROC
DEFFNrom(Y%):IFHIMEM>&FFFF:=""ELSE IF?&FFB9<>&4C:=""ELSE IF?&FFFB>127:=""
B%=&8009:A$="":REPEAT:!&F6=B%:A%=(USR&FFB9)AND&FF:IFA%<32ORA%>127:A%=0
B%=B%+1:IFA%:A$=A$+CHR$A%
UNTILA%=0:=A$
