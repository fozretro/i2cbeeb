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
    throw new Error(
      `${variant.id}: missing ${missing.join(" and ")}. Run ./bin/build.sh from the repo root.`,
    );
  }

  return { ...variant, path: path!, labelsPath: labelsPath! };
}

/** All configure-less ROM variants — throws if any ROM or labels file is absent. */
export function requireRomVariants(repoRoot = repoRootFromFramework()): ResolvedRomVariant[] {
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
