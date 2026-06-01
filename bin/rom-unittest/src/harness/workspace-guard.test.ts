import { describe, expect, it } from "vitest";
import {
  INDV3_ADDRESS,
  MOS_COMMAND_SCRATCH_START,
  assertStarCommandWorkspace,
  compareStarCommandWorkspace,
  poisonStarCommandWorkspace,
} from "./workspace-guard.js";

describe("workspace-guard", () => {
  it("poisons INDV3 and MOS scratch with distinct sentinel bytes", () => {
    const mem = new Map<number, number>();
    const expected = poisonStarCommandWorkspace((a, v) => mem.set(a, v));

    expect(mem.get(INDV3_ADDRESS)).toBe(0x34);
    expect(mem.get(INDV3_ADDRESS + 1)).toBe(0x35);
    expect(mem.get(MOS_COMMAND_SCRATCH_START)).toBe(0xa8);
    expect(mem.get(MOS_COMMAND_SCRATCH_START + 7)).toBe(0xaf);
    expect(expected.indv3).toEqual([0x34, 0x35]);
    expect(expected.scratch).toHaveLength(8);
  });

  it("reports INDV3 violations separately from MOS scratch", () => {
    const expected = poisonStarCommandWorkspace(() => {});
    const read = (address: number) => {
      if (address === INDV3_ADDRESS) return 0xaa;
      if (address === MOS_COMMAND_SCRATCH_START) return 0x00;
      return address >= INDV3_ADDRESS && address <= INDV3_ADDRESS + 1
        ? expected.indv3[address - INDV3_ADDRESS]!
        : expected.scratch[address - MOS_COMMAND_SCRATCH_START]!;
    };

    const violations = compareStarCommandWorkspace(read, expected);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.region)).toEqual(["indv3", "mos-scratch"]);
  });

  it("throws StarCommandWorkspaceError on assert failure", () => {
    const expected = poisonStarCommandWorkspace(() => {});
    expect(() =>
      assertStarCommandWorkspace(() => 0xff, expected),
    ).toThrow(/Star-command workspace violated/);
  });
});
