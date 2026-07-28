import type { PackageManagerName, ToolingSettings } from "../project.types.js";
import { asRecord, asString } from "./scalars.js";

const MANAGERS = new Set<string>(["pnpm", "npm", "bun", "yarn"]);

/**
 * `[tooling]`: which package manager runs underneath.
 *
 * An unrecognised name falls back to pnpm rather than failing, so a manifest
 * written against a newer toolchain still opens.
 */
export function readTooling(data: Record<string, unknown>): ToolingSettings {
  const name = asString(asRecord(data.tooling).manager);
  return { manager: name && MANAGERS.has(name) ? (name as PackageManagerName) : "pnpm" };
}
