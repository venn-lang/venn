import type { BuildTarget } from "../project.types.js";
import { asRecord, asRecords, asString } from "./scalars.js";

/** Where a `lib` target starts when the manifest does not say. */
export const LIB_ROOT = "src/lib.vn";
/** Where the default `bin` target starts when the manifest does not say. */
export const MAIN_ROOT = "src/main.vn";
/** Where additional `bin` targets are looked for by convention. */
export const BIN_DIR = "src/bin";

/**
 * `[lib]` and `[[bin]]`: what this package builds.
 *
 * Only what the manifest *declares*. The conventional roots are filled in by
 * whoever can look at the disk, because a convention is a claim about files
 * existing and this reader is pure. A manifest declaring nothing is the common
 * case, not an empty one.
 */
export function readTargets(data: Record<string, unknown>, packageName: string): BuildTarget[] {
  const found: BuildTarget[] = [];
  if (data.lib !== undefined) found.push(readLib(asRecord(data.lib), packageName));
  for (const entry of asRecords(data.bin)) found.push(readBin(entry, packageName));
  return found;
}

function readLib(table: Record<string, unknown>, packageName: string): BuildTarget {
  return {
    kind: "lib",
    name: asString(table.name) ?? packageName,
    path: asString(table.path) ?? LIB_ROOT,
  };
}

function readBin(table: Record<string, unknown>, packageName: string): BuildTarget {
  const name = asString(table.name) ?? packageName;
  return { kind: "bin", name, path: asString(table.path) ?? `${BIN_DIR}/${name}.vn` };
}
