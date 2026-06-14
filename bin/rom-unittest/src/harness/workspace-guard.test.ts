import { describe, expect, it } from "vitest";
import {
  INDV3_ADDRESS,
  MOS_COMMAND_SCRATCH_START,
  assertWorkspaceGuard,
  compareWorkspaceGuard,
  isAddressInRegions,
  snapshotWorkspaceGuard,
} from "./workspace-guard.js";

describe("workspace-guard", () => {
  it("snapshots all zero page except MOS scratch &A8–&AF", () => {
    const mem = new Map<number, number>();
    for (let address = 0; address < 0x100; address++) {
      mem.set(address, address ^ 0x5a);
    }
    mem.set(INDV3_ADDRESS, 0x34);
    mem.set(INDV3_ADDRESS + 1, 0x35);

    const snapshot = snapshotWorkspaceGuard((address) => mem.get(address) ?? 0);
    expect(snapshot.zeroPage.has(0x6b)).toBe(true);
    expect(snapshot.zeroPage.has(MOS_COMMAND_SCRATCH_START)).toBe(false);
    expect(snapshot.zeroPage.has(MOS_COMMAND_SCRATCH_START + 7)).toBe(false);
    expect(snapshot.zeroPage.size).toBe(0x100 - 8 - 2);
    expect(snapshot.ram.has(INDV3_ADDRESS)).toBe(true);
  });

  it("reports zero-page and INDV3 violations", () => {
    const mem = new Map<number, number>();
    for (let address = 0; address < 0x100; address++) {
      mem.set(address, 0xea);
    }
    mem.set(INDV3_ADDRESS, 0x34);
    mem.set(INDV3_ADDRESS + 1, 0x35);
    const snapshot = snapshotWorkspaceGuard((address) => mem.get(address) ?? 0);
    mem.set(INDV3_ADDRESS, 0xaa);
    mem.set(0x6a, 0x00);

    const violations = compareWorkspaceGuard((address) => mem.get(address) ?? 0, snapshot);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.address === INDV3_ADDRESS)).toBe(true);
  });

  it("allows MOS scratch &A8–&AF to change", () => {
    const mem = new Map<number, number>();
    for (let address = 0; address < 0x100; address++) {
      mem.set(address, 0xea);
    }
    const snapshot = snapshotWorkspaceGuard((address) => mem.get(address) ?? 0);
    for (let address = MOS_COMMAND_SCRATCH_START; address < MOS_COMMAND_SCRATCH_START + 8; address++) {
      mem.set(address, 0);
    }

    const violations = compareWorkspaceGuard((address) => mem.get(address) ?? 0, snapshot);
    expect(violations).toHaveLength(0);
  });

  it("guards optional RAM regions with default harness exempts", () => {
    const mem = new Map<number, number>();
    for (let address = 0x0200; address < 0x0300; address++) {
      mem.set(address, 0xea);
    }
    mem.set(0x0900, 0x54); // command line — exempt

    const snapshot = snapshotWorkspaceGuard((address) => mem.get(address) ?? 0, {
      ramRegions: [{ start: 0x0200, length: 0x100 }],
    });
    expect(snapshot.ram.has(0x0900)).toBe(false);
    expect(snapshot.ram.has(0x0210)).toBe(true);

    mem.set(0x0210, 0x00);
    const violations = compareWorkspaceGuard((address) => mem.get(address) ?? 0, snapshot);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.region).toBe("ram");
    expect(violations[0]?.address).toBe(0x0210);
  });

  it("throws StarCommandWorkspaceError on assert failure", () => {
    const snapshot = snapshotWorkspaceGuard(() => 0xea);
    expect(() => assertWorkspaceGuard(() => 0xff, snapshot)).toThrow(/Workspace guard violated/);
  });

  it("isAddressInRegions merges overlapping exempt checks", () => {
    expect(isAddressInRegions(0xa8, [{ start: 0xa8, length: 8 }])).toBe(true);
    expect(isAddressInRegions(0x6b, [{ start: 0xa8, length: 8 }])).toBe(false);
  });
});
