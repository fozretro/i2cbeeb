import type { JsbeebCpu } from "../cpu/types.js";
import { I2C_BYTE_ADDRESS } from "../bbc/mos.js";
import { DEFAULT_RTC_MOCK_STATE, BLANK_RTC_MOCK_STATE, mergeRtcMockState, type PartialRtcMockState } from "./defaults.js";

/** DS3231-shaped RTC scratch (see `src/I2CBeeb.asm` buf00–buf06, buf12). */
export const RTC_BUF = {
  SECONDS: 0x0380,
  MINUTES: 0x0381,
  HOURS: 0x0382,
  WEEKDAY: 0x0383,
  DATE: 0x0384,
  MONTH: 0x0385,
  YEAR: 0x0386,
  /** Alarm 2 hours — Time-on-Break flag in bits 3–0. */
  TBRK: 0x038c,
  /** DS3231 temperature MSB (integer °C in bits 6–0). */
  TEMPERATURE: 0x0391,
} as const;

export interface RtcMockState {
  seconds: number;
  minutes: number;
  hours: number;
  /** 1=Sun … 7=Sat (DS3231 day register). */
  weekday: number;
  date: number;
  month: number;
  year: number;
  /** Time-on-Break flag stored in buf12 bits 3–0 (0=off, non-zero=on). */
  tbrk: number;
  /** Integer °C in buf17 bits 6–0 (DS3231). */
  temperature: number;
}

/** @deprecated Use {@link RtcMockState} or {@link PartialRtcMockState}. */
export type RtcBcdState = RtcMockState;

/** @deprecated Use {@link PartialRtcMockState}. */
export type RtcBcdTime = PartialRtcMockState;

/**
 * Stateful RTC mock: `getrtc` reads mock state into buf00–buf06 and buf12;
 * `writetd` captures buf00–buf06 back; `wtbrk` captures the ToB flag from `$6A`.
 */
export class RtcMock {
  state: RtcMockState;

  private getrtcHook: { remove(): void } | null = null;
  private writetdHook: { remove(): void } | null = null;
  private wtbrkHook: { remove(): void } | null = null;
  private getrtcAddress: number | null = null;
  private writetdAddress: number | null = null;
  private wtbrkAddress: number | null = null;
  private getrtcOpcode: number | null = null;
  private writetdOpcode: number | null = null;
  private wtbrkOpcode: number | null = null;

  constructor(initial?: PartialRtcMockState) {
    this.state = mergeRtcMockState(initial);
  }

  reset(): void {
    this.state = mergeRtcMockState();
  }

  setState(partial: PartialRtcMockState): void {
    if (partial.seconds !== undefined) this.state.seconds = partial.seconds & 0xff;
    if (partial.minutes !== undefined) this.state.minutes = partial.minutes & 0xff;
    if (partial.hours !== undefined) this.state.hours = partial.hours & 0xff;
    if (partial.weekday !== undefined) this.state.weekday = partial.weekday & 0xff;
    if (partial.date !== undefined) this.state.date = partial.date & 0xff;
    if (partial.month !== undefined) this.state.month = partial.month & 0xff;
    if (partial.year !== undefined) this.state.year = partial.year & 0xff;
    if (partial.tbrk !== undefined) this.state.tbrk = partial.tbrk & 0x0f;
    if (partial.temperature !== undefined) {
      this.state.temperature = partial.temperature & 0x7f;
    }
  }

  install(cpu: JsbeebCpu, getrtcEntry: number, writetdEntry: number, wtbrkEntry: number): void {
    this.detach(cpu);
    this.installGetrtc(cpu, getrtcEntry);
    this.installWritetd(cpu, writetdEntry);
    this.installWtbrk(cpu, wtbrkEntry);
  }

  detach(cpu?: JsbeebCpu): void {
    this.getrtcHook?.remove();
    this.getrtcHook = null;
    this.writetdHook?.remove();
    this.writetdHook = null;
    this.wtbrkHook?.remove();
    this.wtbrkHook = null;
    if (cpu) {
      if (this.getrtcAddress !== null && this.getrtcOpcode !== null) {
        cpu.writemem(this.getrtcAddress, this.getrtcOpcode);
      }
      if (this.writetdAddress !== null && this.writetdOpcode !== null) {
        cpu.writemem(this.writetdAddress, this.writetdOpcode);
      }
      if (this.wtbrkAddress !== null && this.wtbrkOpcode !== null) {
        cpu.writemem(this.wtbrkAddress, this.wtbrkOpcode);
      }
    }
    this.getrtcAddress = null;
    this.writetdAddress = null;
    this.wtbrkAddress = null;
    this.getrtcOpcode = null;
    this.writetdOpcode = null;
    this.wtbrkOpcode = null;
  }

  private installGetrtc(cpu: JsbeebCpu, address: number): void {
    this.getrtcAddress = address;
    this.getrtcOpcode = cpu.readmem(address);
    cpu.writemem(address, 0x60);
    this.getrtcHook = cpu.debugInstruction.add((addr) => {
      if (addr !== address) return false;
      this.applyState(cpu);
      return false;
    });
  }

  private installWritetd(cpu: JsbeebCpu, address: number): void {
    this.writetdAddress = address;
    this.writetdOpcode = cpu.readmem(address);
    cpu.writemem(address, 0x60);
    this.writetdHook = cpu.debugInstruction.add((addr) => {
      if (addr !== address) return false;
      this.captureState(cpu);
      return false;
    });
  }

  private installWtbrk(cpu: JsbeebCpu, address: number): void {
    this.wtbrkAddress = address;
    this.wtbrkOpcode = cpu.readmem(address);
    cpu.writemem(address, 0x60);
    this.wtbrkHook = cpu.debugInstruction.add((addr) => {
      if (addr !== address) return false;
      this.state.tbrk = cpu.readmem(I2C_BYTE_ADDRESS) & 0x0f;
      return false;
    });
  }

  private applyState(cpu: JsbeebCpu): void {
    cpu.writemem(RTC_BUF.SECONDS, this.state.seconds);
    cpu.writemem(RTC_BUF.MINUTES, this.state.minutes);
    cpu.writemem(RTC_BUF.HOURS, this.state.hours);
    cpu.writemem(RTC_BUF.WEEKDAY, this.state.weekday);
    cpu.writemem(RTC_BUF.DATE, this.state.date);
    cpu.writemem(RTC_BUF.MONTH, this.state.month);
    cpu.writemem(RTC_BUF.YEAR, this.state.year);
    cpu.writemem(RTC_BUF.TBRK, this.state.tbrk & 0x0f);
    cpu.writemem(RTC_BUF.TEMPERATURE, this.state.temperature & 0x7f);
  }

  private captureState(cpu: JsbeebCpu): void {
    this.state.seconds = cpu.readmem(RTC_BUF.SECONDS);
    this.state.minutes = cpu.readmem(RTC_BUF.MINUTES);
    this.state.hours = cpu.readmem(RTC_BUF.HOURS);
    this.state.weekday = cpu.readmem(RTC_BUF.WEEKDAY);
    this.state.date = cpu.readmem(RTC_BUF.DATE);
    this.state.month = cpu.readmem(RTC_BUF.MONTH);
    this.state.year = cpu.readmem(RTC_BUF.YEAR);
  }
}

export { DEFAULT_RTC_MOCK_STATE, BLANK_RTC_MOCK_STATE, mergeRtcMockState, type PartialRtcMockState };
