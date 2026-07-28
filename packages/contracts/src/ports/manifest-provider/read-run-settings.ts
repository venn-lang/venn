import type { FormatSettings, Manifest } from "./manifest.types.js";
import { asBoolean, asList, asNumber, asRecord, asStringMap } from "./read/index.js";

type RunSettings = Pick<Manifest, "env" | "envFiles" | "paths" | "format">;

/**
 * How the project runs, as against what it is: environments, path aliases and
 * formatting.
 */
export function readRunSettings(data: Record<string, unknown>): RunSettings {
  return {
    env: readEnv(data.env),
    envFiles: asList(asRecord(data.env).files),
    paths: asStringMap(data.paths),
    format: readFormat(data.format),
  };
}

function readFormat(value: unknown): FormatSettings {
  const table = asRecord(value);
  return {
    indent: asNumber(table.indent),
    tabs: asBoolean(table.tabs),
    organize: asBoolean(table.organize),
    sort: asBoolean(table.sort),
  };
}

/** `files` configures where to read from; every other key names an environment. */
const RESERVED = new Set(["files"]);

function readEnv(value: unknown): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [name, vars] of Object.entries(asRecord(value))) {
    if (!RESERVED.has(name)) out[name] = asStringMap(vars);
  }
  return out;
}
