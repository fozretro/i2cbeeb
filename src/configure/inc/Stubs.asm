\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Stub Routines for Time-Config Dependencies
\\
\ Why these stubs exist:
\ 1. SET_Startup (Settings.asm) calls reset routines - IMPORTANT for user configuration
\    SET_Startup applies user-configured settings on boot
\ 2. TIMEZONE/SUMMERTIME have been removed from config table (base ROM TIME doesn't support them)
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\ RTC routines (from Time.asm)
\ Called by: SET_Startup.resetEverything (line 168-170)
\ Status: SET_Startup is important for applying user configuration on boot
.RTC_resetClock
{
	RTS
}

\ Timezone routines (from SaveTimes.asm)
\ Called by: SET_Startup.resetEverything (line 169)
\ Status: SET_Startup is important for applying user configuration on boot
.RTC_resetTZN
{
	RTS
}

\ Summertime routines (from Summertime.asm)
\ Called by: SET_Startup.resetEverything (line 170)
\ Status: SET_Startup is important for applying user configuration on boot
.DST_reset
{
	RTS
}

\ NOTE: TIME command has been removed from Commands.asm during extraction
\ NOTE: TIMEZONE/SUMMERTIME have been removed from Configure.asm config table
\       (base ROM TIME commands don't support timezone/DST)
\ So RTC_readTimeString, OSW_timeCommand, CON_Timezone, CON_DST and all their
\ helper routines are no longer needed

\ CON_Baud and CON_TV are defined in Configure.asm, so no stubs needed
\ CON_FS and CON_PS are defined in Configure.asm, so no stubs needed

\ Helper routines used by Configure.asm
\ Note: badParam, shifted, endLine are defined in Configure.asm

