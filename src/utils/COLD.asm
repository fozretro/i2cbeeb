\ Electron power-on reset (hoglet / Stardot t=20240)
\ https://stardot.org.uk/forums/viewtopic.php?t=20240
\ MOS 1.00: JMP &D8EB after reset prefix. Not a hardware reset.
\ DFS executable: load/exec &0B00 — run with *COLD or *RUN COLD

ORG &0B00

.power_up_reset
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
	LDA #&02
	JMP &D8EB

SAVE "COLD", &0B00, *
