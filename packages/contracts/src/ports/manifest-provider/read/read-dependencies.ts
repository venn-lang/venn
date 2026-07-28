import type { Dependency } from "../project.types.js";
import { asBoolean, asRecord, asString } from "./scalars.js";

/**
 * A dependency table, in either spelling TOML allows.
 *
 * `zod = "^4"` and `zod = { version = "^4", optional = true }` say the same
 * thing about the version, so both read into one shape rather than two the rest
 * of the code would have to keep apart.
 */
export function readDependencies(value: unknown): Dependency[] {
  return Object.entries(asRecord(value)).map(([name, spec]) => readOne(name, spec));
}

function readOne(name: string, spec: unknown): Dependency {
  if (typeof spec === "string") {
    return { name, version: spec, fromWorkspace: false, optional: false };
  }
  const table = asRecord(spec);
  return {
    name,
    version: asString(table.version),
    path: asString(table.path),
    fromWorkspace: asBoolean(table.workspace) ?? false,
    optional: asBoolean(table.optional) ?? false,
  };
}
