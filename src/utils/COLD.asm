\ Electron power-on reset (JGH .ResetElk / Stardot t=20240)
\ https://stardot.org.uk/forums/viewtopic.php?t=20240
\ RESET+25 via &FFFC; not a hardware reset.
\ DFS executable: load/exec &0B00 — run with *COLD or *RUN COLD
\ ~3s pause before reset for hardware testing

ORG &0B00

.ResetElk
	JSR PrintMsg
	JSR Delay3s
	CLC
	LDA &FFFC
	ADC #25
	STA &A8
	LDA &FFFD
	ADC #0
	STA &A9
	LDA #&40
	STA &0D00
	SEI
	CLD
	LDX #&FF
	TXS
	INX
	STX &FE00
	STX &028D
	LDA #&F8
	STA &FE05
	LDA #2
	JMP (&A8)

.PrintMsg
	LDX #0
.print_lp
	LDA cold_msg,X
	BEQ print_done
	JSR &FFEE
	INX
	BNE print_lp
.print_done
	RTS

\ ~3 seconds at 50Hz; OSBYTE clobbers Y — count down in &AE
.Delay3s
	LDA #150
	STA &AE
.delay_lp
	LDA #19
	JSR &FFF4
	DEC &AE
	BNE delay_lp
	RTS

.cold_msg
	EQUS "COLD: fake power-on in ~3s"
	EQUB 13
	EQUS "Press and hold R or wait...."
	EQUB 13
	EQUB 0

SAVE "COLD", &0B00, *
