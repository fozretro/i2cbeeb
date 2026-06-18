import type { RtcMockState } from "./getrtc-stub.js";

/**
 * Valid default RTC RAM as seen by the ROM after a successful `getrtc` read.
 * BCD time/date matches the values used in datetime integration tests.
 * `tbrk` is the Time-on-Break flag in buf12 bits 3–0 (Alarm 2 hours register).
 */
export const DEFAULT_RTC_MOCK_STATE: RtcMockState = {
  seconds: 0x15,
  minutes: 0x30,
  hours: 0x09,
  weekday: 3,
  date: 0x31,
  month: 0x05,
  year: 0x26,
  tbrk: 0,
  temperature: 0x19,
};

export type PartialRtcMockState = Partial<RtcMockState>;

/** Merge overrides onto {@link DEFAULT_RTC_MOCK_STATE} for per-test setup. */
export function mergeRtcMockState(overrides?: PartialRtcMockState): RtcMockState {
  return { ...DEFAULT_RTC_MOCK_STATE, ...overrides };
}

/** Uninitialised RTC scratch (all zero) — before `getrtc` or after chip erase. */
export const BLANK_RTC_MOCK_STATE: RtcMockState = {
  seconds: 0,
  minutes: 0,
  hours: 0,
  weekday: 0,
  date: 0,
  month: 0,
  year: 0,
  tbrk: 0,
  temperature: 0,
};
