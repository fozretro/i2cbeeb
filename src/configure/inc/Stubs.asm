\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Stub Routines for Time-Config Dependencies
\\
\ Why these stubs exist:
\ 1. SET_Startup (Settings.asm) calls reset routines - but SET_Startup is never called
\    (it's only called from Header.asm service call 1, which we don't include)
\ 2. CMD_Time is in the command table - but we're not registering TIME command
\ 3. CON_Timezone/CON_DST are in Configure.asm jump table - WILL be called via CONFIGURE
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\ RTC routines (from Time.asm)
\ Called by: SET_Startup.resetEverything (line 168-170)
\ Status: SET_Startup is never called (no Header.asm service handler), but code must compile
.RTC_resetClock
{
	RTS
}

\ Timezone routines (from SaveTimes.asm)
\ Called by: SET_Startup.resetEverything (line 169)
\ Status: SET_Startup is never called, but code must compile
.RTC_resetTZN
{
	RTS
}

\ Summertime routines (from Summertime.asm)
\ Called by: SET_Startup.resetEverything (line 170), CON_DST
\ Status: SET_Startup never called, but CON_DST WILL be called via CONFIGURE
.DST_reset
{
	RTS
}

.DST_turnOffAuto
{
	RTS
}

.DST_turnOnAuto
{
	RTS
}

\ RTC time string routines (from TimeStrings.asm)
\ Called by: CMD_Time (Commands.asm line 247)
\ Status: CMD_Time is in command table but we're NOT registering it
\         However, code must compile, so stub needed
.RTC_readTimeString
{
	RTS
}

\ OSWORD routines (from OswordEF.asm)
\ Called by: CMD_Time (Commands.asm line 272)
\ Status: CMD_Time is in command table but we're NOT registering it
\         However, code must compile, so stub needed
.OSW_timeCommand
{
	SEC					\ Set C to indicate error/not handled
	RTS
}

\ OSWORD handlers - not needed for basic CONFIGURE/STATUS, but referenced
.OSWORD0E
{
	LDA #8				\ Return service call number to pass on
	RTS
}

.OSWORD0F
{
	LDA #8				\ Return service call number to pass on
	RTS
}

\ Timezone/DST routines (from ConfigTime.asm, TimeStrings.asm)
\ Called by: CON_Timezone, CON_DST (via Configure.asm jump table lines 26-27)
\ Status: WILL BE CALLED if user runs *CONFIGURE TIMEZONE or *CONFIGURE SUMMERTIME
\         These are in the config table, so stubs are required
.RTC_ListZones
{
	RTS
}

.RTC_ParseTZN
{
	SEC					\ Set C to indicate not found
	RTS
}

.RTC_rewriteTZN
{
	RTS
}

.RTC_ParseTimeZone
{
	SEC					\ Set C to indicate error
	RTS
}

.RTC_ParseTimeZoneMin
{
	SEC					\ Set C to indicate error
	RTS
}

.RTC_ParseTimespec
{
	SEC					\ Set C to indicate error
	RTS
}

.RTC_printTimespec
{
	RTS
}

.RTC_TLAtoText
{
	RTS
}

.RTC_BCDtoText
{
	RTS
}

\ String tables (from TimeStrings.asm) - empty stubs
.RTC_ListZoneString
	EQUB 0

.RTC_OrdinalsString
	EQUB 0

.RTC_DaysString
	EQUB 0

.RTC_MonthsString
	EQUB 0

.RTC_TLAtable
	EQUB 0

\ Temporary variables used by timezone routines
TempHourOffset = temp1
TempMinuteOffset = temp2
TempMonth = temp1
TempWkday = temp2
TempDay = temp1
TempHour = temp2
TempMinute = temp1

\ CON_* routines (from ConfigTime.asm) - stubs for now
\ These are referenced in Configure.asm but defined in ConfigTime.asm
.CON_Timezone
{
	BCC timezoneStatus
	\ Set timezone (not implemented yet)
	LDA #0
	RTS
.timezoneStatus
	\ Show timezone status (not implemented yet)
	LDA #0
	RTS
}

.CON_DST
{
	BCC dstStatus
	\ Set DST (not implemented yet)
	LDA #0
	RTS
.dstStatus
	\ Show DST status (not implemented yet)
	LDA #0
	RTS
}

\ CON_Baud and CON_TV are defined in Configure.asm, so no stubs needed
\ CON_FS and CON_PS are defined in Configure.asm, so no stubs needed

\ Helper routines used by Configure.asm
\ Note: badParam, shifted, endLine are defined in Configure.asm

