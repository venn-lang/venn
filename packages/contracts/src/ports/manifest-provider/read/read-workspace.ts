import type { WorkspaceSettings } from "../project.types.js";
import { readDependencies } from "./read-dependencies.js";
import { readInheritable } from "./read-package.js";
import { asList, asRecord } from "./scalars.js";

/**
 * `[workspace]`, or undefined when the manifest is a plain package.
 *
 * A root may also be a package, so `[workspace]` and `[package]` are read
 * separately and never merged.
 */
export function readWorkspace(data: Record<string, unknown>): WorkspaceSettings | undefined {
  if (data.workspace === undefined) return undefined;
  const table = asRecord(data.workspace);
  return {
    members: asList(table.members),
    exclude: asList(table.exclude),
    defaultMembers: asList(table["default-members"]),
    package: readInheritable(asRecord(table.package)),
    dependencies: readDependencies(table.dependencies),
  };
}
