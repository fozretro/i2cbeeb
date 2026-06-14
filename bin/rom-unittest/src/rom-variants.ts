import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface RomVariant {
  id: string;
  label: string;
  /** Fresh build output (preferred when running from `./bin/build.sh`). */
  buildPath: string;
  buildLabelsPath: string;
  /** Copied artefact under `dist/` (used by standalone `npm test`). */
  distPath: string;
  distLabelsPath: string;
  /**
   * I²C is embedded in a larger amalgam — `$8003` is not the I²C service JMP.
   * Tests invoke the relocated I²C `service` label directly.
   */
  embeddedSlice?: boolean;
}

export const CONFIGLESS_ROM_VARIANTS: RomVariant[] = [
  {
    id: "i2cbc",
    label: "BBC configure-less / DS3231",
    buildPath: "src/out/configb/C.I2CB",
    buildLabelsPath: "src/out/C.I2CB.labels",
    distPath: "dist/i2cbc.rom",
    distLabelsPath: "dist/i2cbc.labels",
  },
  {
    id: "i2cec",
    label: "Electron configure-less / DS3231",
    buildPath: "src/out/confige/C.I2CE",
    buildLabelsPath: "src/out/C.I2CE.labels",
    distPath: "dist/i2cec.rom",
    distLabelsPath: "dist/i2cec.labels",
  },
  {
    id: "i2ceap6c",
    label: "EAP6 configure-less / PCF8583",
    buildPath: "src/out/configap6c/C.I2CEAP6",
    buildLabelsPath: "src/out/C.I2CEAP6.labels",
    distPath: "dist/i2ceap6c.rom",
    distLabelsPath: "dist/i2ceap6c.labels",
  },
];

/** INC_CONFIG=1 ROMs with *CONFIGURE / *STATUS (requires FRAM + BeebAsm labels). */
export const CONFIGURE_ROM_VARIANTS: RomVariant[] = [
  {
    id: "i2ceap6c",
    label: "EAP6 configure / PCF8583",
    buildPath: "src/out/configap6c/C.I2CEAP6",
    buildLabelsPath: "src/out/C.I2CEAP6.labels",
    distPath: "dist/i2ceap6c.rom",
    distLabelsPath: "dist/i2ceap6c.labels",
  },
];

/** Electron AP6 I²C *CONFIGURE ROM (PCF8583 NVRAM) — sole entry in {@link CONFIGURE_ROM_VARIANTS}. */
export const EAP6_CONFIGURE_ROM_ID = CONFIGURE_ROM_VARIANTS[0]!.id;

/** Composite AP6 support ROM with embedded I²C slice (requires `./bin/buildap6/build.sh`). */
export const COMPOSITE_ROM_VARIANTS: RomVariant[] = [
  {
    id: "ap6",
    label: "AP6 amalgam / embedded I²C",
    buildPath: "dist/ap6.rom",
    buildLabelsPath: "dist/ap6-i2c.labels",
    distPath: "dist/ap6.rom",
    distLabelsPath: "dist/ap6-i2c.labels",
    embeddedSlice: true,
  },
];

/** Classic AP6 amalgam (TreeCopy, no I²C) for ROM Manager / Plus 1 tests. */
export interface ClassicCompositeRomVariant {
  id: string;
  label: string;
  buildPath: string;
  distPath: string;
}

export const CLASSIC_COMPOSITE_ROM_VARIANTS: ClassicCompositeRomVariant[] = [
  {
    id: "ap6-classic-composite",
    label: "AP6 classic amalgam (TreeCopy, no I²C)",
    buildPath: "bin/buildap6/out/ap6-classic.rom",
    distPath: "bin/buildap6/out/ap6-classic.rom",
  },
];

export type ClassicCompositeTestMode = "off" | "only";

/** `off` — classic amalgam tests skipped. `only` — ap6-classic-composite tests run. */
export function classicCompositeTestMode(): ClassicCompositeTestMode {
  return process.env.I2CBEEB_TEST_AP6_CLASSIC === "only" ? "only" : "off";
}

/** How the AP6 amalgam fixture participates in Vitest variant lists. */
export type CompositeTestMode = "off" | "append" | "only";

/**
 * `off` — standalone fixtures only (default `npm test`).
 * `only` — **`ap6`** amalgam only (`npm run test:composite`, buildap6 Step 4a).
 * `append` — standalone plus composite (manual full matrix).
 */
export function compositeTestMode(): CompositeTestMode {
  const value = process.env.I2CBEEB_TEST_COMPOSITE;
  if (value === "only") {
    return "only";
  }
  if (value === "1" || value === "append") {
    return "append";
  }
  return "off";
}

export interface ResolvedRomVariant extends RomVariant {
  path: string;
  labelsPath: string;
}

export function repoRootFromFramework(): string {
  return resolve(import.meta.dirname, "../../..");
}

function resolveFirstExisting(repoRoot: string, relativePaths: string[]): string | null {
  for (const relativePath of relativePaths) {
    const absolutePath = resolve(repoRoot, relativePath);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }
  return null;
}

function resolveRomVariant(variant: RomVariant, repoRoot: string): ResolvedRomVariant {
  const path = resolveFirstExisting(repoRoot, [variant.buildPath, variant.distPath]);
  const labelsPath = resolveFirstExisting(repoRoot, [variant.buildLabelsPath, variant.distLabelsPath]);
  const missing: string[] = [];

  if (!path) {
    missing.push(`ROM (${variant.buildPath} or ${variant.distPath})`);
  }
  if (!labelsPath) {
    missing.push(`labels (${variant.buildLabelsPath} or ${variant.distLabelsPath})`);
  }
  if (missing.length > 0) {
    const buildHint =
      variant.id === "ap6"
        ? "Run ./bin/buildap6/build.sh from the repo root."
        : variant.id === "ap6-classic-composite"
          ? "Run ./bin/buildap6/build.sh --layout classic from the repo root."
          : "Run ./bin/build.sh from the repo root.";
    throw new Error(`${variant.id}: missing ${missing.join(" and ")}. ${buildHint}`);
  }

  return { ...variant, path: path!, labelsPath: labelsPath! };
}

/** Standalone configure-less ROM variants (`i2cbc`, `i2cec`, `i2ceap6c`). */
export function requireConfiglessRomVariants(repoRoot = repoRootFromFramework()): ResolvedRomVariant[] {
  const errors: string[] = [];
  const resolved: ResolvedRomVariant[] = [];

  for (const variant of CONFIGLESS_ROM_VARIANTS) {
    try {
      resolved.push(resolveRomVariant(variant, repoRoot));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new Error(`ROM unit tests require a full build.\n${errors.join("\n")}`);
  }

  return resolved;
}

/** @deprecated Use {@link requireConfiglessRomVariants} in standalone tests; fixture folders select ROM set. */
export function requireRomVariants(repoRoot = repoRootFromFramework()): ResolvedRomVariant[] {
  return appendCompositeWhenEnabled(requireConfiglessRomVariants(repoRoot), repoRoot);
}

/**
 * `configure/` folder — standalone project uses INC_CONFIG EAP6 ROM;
 * composite project (`I2CBEEB_TEST_COMPOSITE=only` in `vitest.config.ts`) uses `dist/ap6.rom`.
 */
export function requireConfigureFolderVariants(repoRoot = repoRootFromFramework()): ResolvedRomVariant[] {
  if (compositeTestMode() === "only") {
    return requireCompositeRomVariants(repoRoot);
  }
  return requireConfigureRomVariants(repoRoot);
}

/** Configure ROM variants — throws if any ROM or labels file is absent. */
export function requireConfigureRomVariants(repoRoot = repoRootFromFramework()): ResolvedRomVariant[] {
  const errors: string[] = [];
  const resolved: ResolvedRomVariant[] = [];

  for (const variant of CONFIGURE_ROM_VARIANTS) {
    try {
      resolved.push(resolveRomVariant(variant, repoRoot));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configure ROM unit tests require a full build.\n${errors.join("\n")}`);
  }

  return resolved;
}

/** Resolve one configure ROM variant by {@link RomVariant.id}. */
export function requireConfigureRomVariant(
  id: string,
  repoRoot = repoRootFromFramework(),
): ResolvedRomVariant {
  const match = requireConfigureRomVariants(repoRoot).find((v) => v.id === id);
  if (!match) {
    const available = requireConfigureRomVariants(repoRoot)
      .map((v) => v.id)
      .join(", ");
    throw new Error(`Configure ROM variant "${id}" not found. Available: ${available}`);
  }
  return match;
}

function appendCompositeWhenEnabled(
  resolved: ResolvedRomVariant[],
  repoRoot: string,
): ResolvedRomVariant[] {
  if (compositeTestMode() !== "append") {
    return resolved;
  }
  return [...resolved, ...requireCompositeRomVariants(repoRoot)];
}

/** Composite AP6 ROM variants — throws if amalgamated ROM or relocated I²C labels are absent. */
export function requireCompositeRomVariants(repoRoot = repoRootFromFramework()): ResolvedRomVariant[] {
  const errors: string[] = [];
  const resolved: ResolvedRomVariant[] = [];

  for (const variant of COMPOSITE_ROM_VARIANTS) {
    try {
      resolved.push(resolveRomVariant(variant, repoRoot));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new Error(`Composite ROM unit tests require an AP6 build.\n${errors.join("\n")}`);
  }

  return resolved;
}

/** Classic AP6 amalgam — throws if ap6-classic.rom is absent. */
export interface ResolvedClassicCompositeVariant extends ClassicCompositeRomVariant {
  path: string;
}

export function requireClassicCompositeVariants(
  repoRoot = repoRootFromFramework(),
): ResolvedClassicCompositeVariant[] {
  const errors: string[] = [];
  const resolved: ResolvedClassicCompositeVariant[] = [];

  for (const variant of CLASSIC_COMPOSITE_ROM_VARIANTS) {
    try {
      resolved.push(resolveClassicCompositeVariant(variant, repoRoot));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new Error(`Classic composite ROM unit tests require an AP6 classic build.\n${errors.join("\n")}`);
  }

  return resolved;
}

function resolveClassicCompositeVariant(
  variant: ClassicCompositeRomVariant,
  repoRoot: string,
): ResolvedClassicCompositeVariant {
  const path = resolveFirstExisting(repoRoot, [variant.buildPath, variant.distPath]);
  if (!path) {
    throw new Error(
      `${variant.id}: missing ROM (${variant.buildPath} or ${variant.distPath}). Run ./bin/buildap6/build.sh --layout classic from the repo root.`,
    );
  }
  return { ...variant, path };
}
