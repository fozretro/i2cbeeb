\ Electron power-on reset (JGH .ResetElk / Stardot t=20240)
\ https://stardot.org.uk/forums/viewtopic.php?t=20240
\ RESET+25 via &FFFC; not a hardware reset.
\ DFS executable: load/exec &0B00 — run with *COLD or *RUN COLD

ORG &0B00

.ResetElk
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

SAVE "COLD", &0B00, *
