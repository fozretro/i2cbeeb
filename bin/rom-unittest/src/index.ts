export { MOS, ROM_BASE, ROM_SIZE, ZP, I2CWRK_ADDRESS, I2C_BYTE_ADDRESS, I2C_BUF_ADDRESS, I2C_SLOT_ADDRESS, I2C_ZPREG_ADDRESS, MOS_ROM_SLOT } from "./bbc/mos.js";
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
  I2CBeebRomTestHarness,
  loadRomImage,
  parseServiceEntry,
  writeCommandLine,
} from "./harness/rom-test-harness.js";
export type { CommandCallOptions, I2CBeebRomHarnessOptions, ServiceCallOptions } from "./harness/rom-test-harness.js";
export {
  MOS_SERVICE_UNKNOWN_OSBYTE,
  MOS_SERVICE_UNKNOWN_OSWORD,
  OSWORD_CTRL_BLOCK,
  OSWORD_CTRL_LENGTH,
  nullTerminatedAscii,
  oswordBlockFirstWord,
  oswordNoResponse,
  type OsbyteInvokeOptions,
  type OsbyteInvokeResult,
  type OswordInvokeOptions,
  type OswordInvokeResult,
} from "./harness/mos-service-call.js";
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
  i2cBusHookAddresses,
  rtcHookAddresses,
  serviceEntryAddress,
  symbolAddress,
  translateCompositeLabels,
  formatBeebAsmLabels,
} from "./beebasm/labels.js";
export type { BeebAsmSymbols } from "./beebasm/labels.js";
export { RtcMock, RTC_BUF, DEFAULT_RTC_MOCK_STATE, BLANK_RTC_MOCK_STATE, mergeRtcMockState } from "./rtc/getrtc-stub.js";
export { I2cBusMock } from "./i2c/bus-mock.js";
export type { I2cBusHookAddresses } from "./i2c/bus-mock.js";
export type {
  PartialRtcMockState,
  RtcBcdState,
  RtcBcdTime,
  RtcMockState,
} from "./rtc/getrtc-stub.js";
export { NvramMock, createDefaultNvramImage, createBlankNvramImage, mergeNvramImage, installConfigureWorkspaceStubs } from "./nvram/nvram-mock.js";
export type { NvramImage, PartialNvramImage } from "./nvram/nvram-mock.js";
export {
  RomManagerTestHarness,
  ROM_MANAGER_L0D6D,
  MOS_BREAK_TYPE,
  MOS_LANGUAGE_ROM_NUMBER,
  MOS_TUBE_ENABLE,
} from "./harness/rom-manager-harness.js";
export type { RomManagerHarnessOptions } from "./harness/rom-manager-harness.js";
export {
  Plus1SupportTestHarness,
  MOS_LANG_ROM_TYPE,
} from "./harness/plus1-support-harness.js";
export type { Plus1SupportHarnessOptions } from "./harness/plus1-support-harness.js";
export {
  DEFAULT_CONFIGURE_NVRAM,
  NVR_DefaultRoms,
  NVR_FILE_MASK,
  NVR_KeyRptDelay,
  NVR_LANG_MASK,
  NVR_MODE_MASK,
  NVR_InitMarker,
  NVR_NVRSize,
  NVR_PRINT_MASK,
  NVR_PRINT_SHIFT,
  NVR_TubeSerialPrint,
  NVR_VDUSettings,
  createDefaultConfigureNvramImage,
  nvramBaudRate,
  nvramFile,
  nvramLang,
  nvramMode,
  nvramPrinter,
  nvramTubeEnabled,
} from "./nvram/configure-defaults.js";
export {
  CONFIGLESS_ROM_VARIANTS,
  CONFIGURE_ROM_VARIANTS,
  EAP6_CONFIGURE_ROM_ID,
  COMPOSITE_ROM_VARIANTS,
  requireConfiglessRomVariants,
  requireConfigureRomVariants,
  requireConfigureFolderVariants,
  requireConfigureRomVariant,
  requireCompositeRomVariants,
  requireClassicCompositeVariants,
  compositeTestMode,
  classicCompositeTestMode,
  repoRootFromFramework,
} from "./rom-variants.js";
export type {
  ResolvedRomVariant,
  ResolvedClassicCompositeVariant,
  RomVariant,
  CompositeTestMode,
  ClassicCompositeTestMode,
} from "./rom-variants.js";
export { Ap6ClassicAmalgamSession } from "./harness/ap6-classic-amalgam.js";
export {
  writeNVRAMStore,
  writeClassicServ7TubeEnabled,
  readNVRAMStore,
} from "./harness/classic-serv7-osbyte.js";
export {
  expectByte,
  expectNvramByte,
} from "./assertions/expect-byte.js";
export type { ExpectByteOptions, MemoryReader } from "./assertions/expect-byte.js";
