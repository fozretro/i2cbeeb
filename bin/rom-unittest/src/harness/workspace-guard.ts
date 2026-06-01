/**
 * MOS workspace guards for issue #12 — star-command scratch etiquette.
 *
 * Poison sentinel bytes before a ROM service invoke; assert they are unchanged
 * after return. Wired automatically by {@link RomTestHarness}.
 */

/** Language indirection vector (INDV3) — must not be used as COMVEC. */
export const INDV3_ADDRESS = 0x0234;

/** MOS scratch for OS `*` commands (Advanced User Guide convention). */
export const MOS_COMMAND_SCRATCH_START = 0x00a8;
export const MOS_COMMAND_SCRATCH_BYTES = 8;

export type WorkspaceRegion = "indv3" | "mos-scratch";

export interface WorkspaceGuardViolation {
  region: WorkspaceRegion;
  address: number;
  expected: number;
  actual: number;
}

/** Expected byte values after {@link poisonStarCommandWorkspace}. */
export interface GuardedWorkspace {
  indv3: readonly [number, number];
  scratch: readonly number[];
}

export class StarCommandWorkspaceError extends Error {
  readonly violations: WorkspaceGuardViolation[];

  constructor(violations: WorkspaceGuardViolation[]) {
    const detail = violations
      .map(
        (v) =>
          `  ${v.region} &${v.address.toString(16).toUpperCase()}: expected $${v.expected
            .toString(16)
            .toUpperCase()
            .padStart(2, "0")}, got $${v.actual.toString(16).toUpperCase().padStart(2, "0")}`,
      )
      .join("\n");
    super(`Star-command workspace violated (#12):\n${detail}`);
    this.name = "StarCommandWorkspaceError";
    this.violations = violations;
  }
}

function scratchSentinel(offset: number): number {
  return (MOS_COMMAND_SCRATCH_START + offset) & 0xff;
}

/** Write distinct sentinel patterns to guarded regions; return expected post-poison values. */
export function poisonStarCommandWorkspace(
  write: (address: number, value: number) => void,
): GuardedWorkspace {
  const indv3: [number, number] = [0x34, 0x35];
  write(INDV3_ADDRESS, indv3[0]!);
  write(INDV3_ADDRESS + 1, indv3[1]!);

  const scratch: number[] = [];
  for (let i = 0; i < MOS_COMMAND_SCRATCH_BYTES; i++) {
    const value = scratchSentinel(i);
    scratch.push(value);
    write(MOS_COMMAND_SCRATCH_START + i, value);
  }

  return { indv3, scratch };
}

/** Compare live memory to the snapshot taken immediately after poisoning. */
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
      violations.push({ region: "indv3", address, expected: want, actual });
    }
  }

  for (let i = 0; i < MOS_COMMAND_SCRATCH_BYTES; i++) {
    const address = MOS_COMMAND_SCRATCH_START + i;
    const actual = read(address) & 0xff;
    const want = expected.scratch[i]!;
    if (actual !== want) {
      violations.push({ region: "mos-scratch", address, expected: want, actual });
    }
  }

  return violations;
}

/** Throw {@link StarCommandWorkspaceError} when any guarded byte changed. */
export function assertStarCommandWorkspace(
  read: (address: number) => number,
  expected: GuardedWorkspace,
): void {
  const violations = compareStarCommandWorkspace(read, expected);
  if (violations.length > 0) {
    throw new StarCommandWorkspaceError(violations);
  }
}
