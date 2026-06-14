/**
 * MOS workspace guards for issue #12 — star-command scratch etiquette.
 *
 * Snapshot zero page (and optionally other RAM) after harness setup; assert
 * only MOS star-command scratch (&A8–&AF) may change
 */

/** Language indirection vector (INDV3) — must not be used as COMVEC. */
export const INDV3_ADDRESS = 0x0234;

/** MOS scratch for OS `*` commands (Advanced User Guide convention). */
export const MOS_COMMAND_SCRATCH_START = 0x00a8;
export const MOS_COMMAND_SCRATCH_BYTES = 8;

export const ZERO_PAGE_SIZE = 0x100;

export interface MemoryRegion {
  start: number;
  length: number;
}

/** Default: ROM may freely use MOS star-command scratch (&A8–&AF; parser at +3..+7). */
export const DEFAULT_ZERO_PAGE_EXEMPT: readonly MemoryRegion[] = [
  { start: MOS_COMMAND_SCRATCH_START, length: MOS_COMMAND_SCRATCH_BYTES },
  { start: 0x00e4, length: 2 }, // Time-Config TempSpace2 — STR_PrintString pointer
];

/** MOS error pointer — repointed on Time-Config validation BRK paths. */
export const MOS_ERROR_PTR_ADDRESS = 0x00fd;

/** Low RAM outside zero page that must never be used as command workspace. */
export const DEFAULT_CRITICAL_RAM_GUARD: readonly MemoryRegion[] = [
  { start: INDV3_ADDRESS, length: 2 },
];

/** Harness-owned RAM that extended guards should skip by default. */
export const DEFAULT_RAM_GUARD_EXEMPT: readonly MemoryRegion[] = [
  { start: 0x0100, length: 0x100 }, // 6502 stack page
  { start: 0x0200, length: 0x001 }, // return trampoline (NOP)
  { start: 0x02e0, length: 0x010 }, // I2CBeeb i2cwrk command workspace
  { start: 0x0900, length: 0x100 }, // default * command line buffer
  { start: 0x0a00, length: 0x100 }, // i2cbuf
];

export type WorkspaceRegion = "zero-page" | "ram";

export interface WorkspaceGuardViolation {
  region: WorkspaceRegion;
  address: number;
  expected: number;
  actual: number;
}

export interface WorkspaceGuardOptions {
  /** Zero-page ranges the ROM may modify (default {@link DEFAULT_ZERO_PAGE_EXEMPT}). */
  zeroPageExempt?: readonly MemoryRegion[];
  /** Additional RAM to guard (off by default). */
  ramRegions?: readonly MemoryRegion[];
  /** Sub-ranges excluded from {@link ramRegions} checks. */
  ramExempt?: readonly MemoryRegion[];
}

export interface WorkspaceSnapshot {
  zeroPage: Map<number, number>;
  ram: Map<number, number>;
}

export class StarCommandWorkspaceError extends Error {
  readonly violations: WorkspaceGuardViolation[];

  constructor(violations: WorkspaceGuardViolation[]) {
    const detail = violations
      .slice(0, 16)
      .map(
        (v) =>
          `  ${v.region} &${v.address.toString(16).toUpperCase().padStart(4, "0")}: expected $${v.expected
            .toString(16)
            .toUpperCase()
            .padStart(2, "0")}, got $${v.actual.toString(16).toUpperCase().padStart(2, "0")}`,
      )
      .join("\n");
    const suffix =
      violations.length > 16 ? `\n  … and ${violations.length - 16} more` : "";
    super(`Workspace guard violated (#12):\n${detail}${suffix}`);
    this.name = "StarCommandWorkspaceError";
    this.violations = violations;
  }
}

function mergeRegions(regions: readonly MemoryRegion[]): MemoryRegion[] {
  if (regions.length === 0) {
    return [];
  }
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  const merged: MemoryRegion[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    const lastEnd = last.start + last.length;
    if (current.start <= lastEnd) {
      const end = Math.max(lastEnd, current.start + current.length);
      last.length = end - last.start;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

export function isAddressInRegions(
  address: number,
  regions: readonly MemoryRegion[],
): boolean {
  for (const region of regions) {
    if (address >= region.start && address < region.start + region.length) {
      return true;
    }
  }
  return false;
}

function guardedZeroPageAddresses(exempt: readonly MemoryRegion[]): number[] {
  const addresses: number[] = [];
  for (let address = 0; address < ZERO_PAGE_SIZE; address++) {
    if (!isAddressInRegions(address, exempt)) {
      addresses.push(address);
    }
  }
  return addresses;
}

function guardedRamAddresses(
  regions: readonly MemoryRegion[],
  exempt: readonly MemoryRegion[],
): number[] {
  const addresses: number[] = [];
  for (const region of regions) {
    for (let offset = 0; offset < region.length; offset++) {
      const address = region.start + offset;
      if (!isAddressInRegions(address, exempt)) {
        addresses.push(address);
      }
    }
  }
  return addresses;
}

/** Record guarded bytes after harness setup; return snapshot for post-invoke compare. */
export function snapshotWorkspaceGuard(
  read: (address: number) => number,
  options: WorkspaceGuardOptions = {},
): WorkspaceSnapshot {
  const zeroPageExempt = options.zeroPageExempt ?? DEFAULT_ZERO_PAGE_EXEMPT;
  const ramRegions = mergeRegions([
    ...DEFAULT_CRITICAL_RAM_GUARD,
    ...(options.ramRegions ?? []),
  ]);
  const ramExempt = mergeRegions([
    ...DEFAULT_RAM_GUARD_EXEMPT,
    ...(options.ramExempt ?? []),
  ]);

  const zeroPage = new Map<number, number>();
  for (const address of guardedZeroPageAddresses(zeroPageExempt)) {
    zeroPage.set(address, read(address) & 0xff);
  }

  const ram = new Map<number, number>();
  for (const address of guardedRamAddresses(ramRegions, ramExempt)) {
    ram.set(address, read(address) & 0xff);
  }

  return { zeroPage, ram };
}

/** Compare live memory to a pre-invoke snapshot. */
export function compareWorkspaceGuard(
  read: (address: number) => number,
  snapshot: WorkspaceSnapshot,
): WorkspaceGuardViolation[] {
  const violations: WorkspaceGuardViolation[] = [];

  for (const [address, expected] of snapshot.zeroPage) {
    const actual = read(address) & 0xff;
    if (actual !== expected) {
      violations.push({ region: "zero-page", address, expected, actual });
    }
  }

  for (const [address, expected] of snapshot.ram) {
    const actual = read(address) & 0xff;
    if (actual !== expected) {
      violations.push({ region: "ram", address, expected, actual });
    }
  }

  return violations;
}

/** Throw {@link StarCommandWorkspaceError} when any guarded byte changed. */
export function assertWorkspaceGuard(
  read: (address: number) => number,
  snapshot: WorkspaceSnapshot,
): void {
  const violations = compareWorkspaceGuard(read, snapshot);
  if (violations.length > 0) {
    throw new StarCommandWorkspaceError(violations);
  }
}

/** @deprecated Use {@link snapshotWorkspaceGuard} — kept for older tests. */
export interface GuardedWorkspace {
  indv3: readonly [number, number];
  scratch: readonly number[];
}

/** @deprecated Use {@link snapshotWorkspaceGuard}. */
export function poisonStarCommandWorkspace(
  write: (address: number, value: number) => void,
): GuardedWorkspace {
  const indv3: [number, number] = [0x34, 0x35];
  write(INDV3_ADDRESS, indv3[0]!);
  write(INDV3_ADDRESS + 1, indv3[1]!);

  const scratch: number[] = [];
  for (let i = 0; i < MOS_COMMAND_SCRATCH_BYTES; i++) {
    const value = (MOS_COMMAND_SCRATCH_START + i) & 0xff;
    scratch.push(value);
    write(MOS_COMMAND_SCRATCH_START + i, value);
  }

  return { indv3, scratch };
}

/** @deprecated Use {@link compareWorkspaceGuard}. */
export function compareStarCommandWorkspace(
  read: (address: number) => number,
  expected: GuardedWorkspace,
): WorkspaceGuardViolation[] {
  const violations: WorkspaceGuardViolation[] = [];

  for (let i = 0; i < 2; i++) {
    const address = INDV3_ADDRESS + i;
    const actual = read(address) & 0xff;
    const want = expected.indv3[i]!;
    if (actual !== want) {
      violations.push({ region: "zero-page", address, expected: want, actual });
    }
  }

  for (let i = 0; i < MOS_COMMAND_SCRATCH_BYTES; i++) {
    const address = MOS_COMMAND_SCRATCH_START + i;
    const actual = read(address) & 0xff;
    const want = expected.scratch[i]!;
    if (actual !== want) {
      violations.push({ region: "zero-page", address, expected: want, actual });
    }
  }

  return violations;
}

/** @deprecated Use {@link assertWorkspaceGuard}. */
export function assertStarCommandWorkspace(
  read: (address: number) => number,
  expected: GuardedWorkspace,
): void {
  const violations = compareStarCommandWorkspace(read, expected);
  if (violations.length > 0) {
    throw new StarCommandWorkspaceError(violations);
  }
}
