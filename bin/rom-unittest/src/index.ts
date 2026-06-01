export { MOS, ROM_BASE, ROM_SIZE, ZP, I2CWRK_ADDRESS, I2C_BYTE_ADDRESS } from "./bbc/mos.js";
export type { MosVector } from "./bbc/mos.js";
export {
  createJsbeebCpu,
  defaultCpuFactory,
  fillMemory,
  pushReturnAddress,
  readFlags,
  run6502,
  snapshotRegisters,
  writeFlags,
} from "./cpu/jsbeeb-cpu.js";
export type { CpuFactory, CpuRegisters, JsbeebCpu, RunOptions, RunResult } from "./cpu/types.js";
export { MosMock, isMosVector } from "./mos/mos-mock.js";
export type { MosByteCall, MosWordCall, OsbyteHandler, OscliHandler, OswordHandler, OswrchHandler } from "./mos/mos-mock.js";
export {
  RomTestHarness,
  loadRomImage,
  parseServiceEntry,
  writeCommandLine,
} from "./harness/rom-test-harness.js";
export type { CommandCallOptions, RomHarnessOptions, ServiceCallOptions } from "./harness/rom-test-harness.js";
export {
  INDV3_ADDRESS,
  MOS_COMMAND_SCRATCH_START,
  MOS_COMMAND_SCRATCH_BYTES,
  ZERO_PAGE_SIZE,
  DEFAULT_ZERO_PAGE_EXEMPT,
  DEFAULT_CRITICAL_RAM_GUARD,
  DEFAULT_RAM_GUARD_EXEMPT,
  StarCommandWorkspaceError,
  assertWorkspaceGuard,
  compareWorkspaceGuard,
  isAddressInRegions,
  MOS_ERROR_PTR_ADDRESS,
  snapshotWorkspaceGuard,
  assertStarCommandWorkspace,
  compareStarCommandWorkspace,
  poisonStarCommandWorkspace,
} from "./harness/workspace-guard.js";
export type {
  GuardedWorkspace,
  MemoryRegion,
  WorkspaceGuardOptions,
  WorkspaceGuardViolation,
  WorkspaceRegion,
  WorkspaceSnapshot,
} from "./harness/workspace-guard.js";
export {
  loadBeebAsmLabels,
  parseBeebAsmLabels,
  requireSymbolAddress,
  configureHookAddresses,
  rtcHookAddresses,
  serviceEntryAddress,
  symbolAddress,
  translateCompositeLabels,
  formatBeebAsmLabels,
} from "./beebasm/labels.js";
export type { BeebAsmSymbols } from "./beebasm/labels.js";
export { RtcMock, RTC_BUF, DEFAULT_RTC_MOCK_STATE, BLANK_RTC_MOCK_STATE, mergeRtcMockState } from "./rtc/getrtc-stub.js";
export type {
  PartialRtcMockState,
  RtcBcdState,
  RtcBcdTime,
  RtcMockState,
} from "./rtc/getrtc-stub.js";
export { NvramMock, createDefaultNvramImage, createBlankNvramImage, mergeNvramImage, installConfigureWorkspaceStubs } from "./nvram/nvram-mock.js";
export type { NvramImage, PartialNvramImage } from "./nvram/nvram-mock.js";
export {
  DEFAULT_CONFIGURE_NVRAM,
  NVR_DefaultRoms,
  NVR_FILE_MASK,
  NVR_KeyRptDelay,
  NVR_LANG_MASK,
  NVR_MODE_MASK,
  NVR_NVRSize,
  NVR_TubeSerialPrint,
  NVR_VDUSettings,
  createDefaultConfigureNvramImage,
  nvramBaudRate,
  nvramFile,
  nvramLang,
  nvramMode,
} from "./nvram/configure-defaults.js";
export {
  CONFIGLESS_ROM_VARIANTS,
  CONFIGURE_ROM_VARIANTS,
  COMPOSITE_ROM_VARIANTS,
  requireRomVariants,
  requireConfigureRomVariants,
  requireCompositeRomVariants,
  compositeTestsEnabled,
  compositeTestMode,
  repoRootFromFramework,
} from "./rom-variants.js";
export type { ResolvedRomVariant, RomVariant, CompositeTestMode } from "./rom-variants.js";
