import type { StrayKey } from "./stray-keys.types.js";
import { parseToml } from "./toml/index.js";

/**
 * Every top-level table, and the keys each one reads.
 *
 * `undefined` means every key in that table names something, so nothing there
 * can be stray: an environment, a path alias, a dependency, a profile.
 *
 * A key nothing reads yet is still listed, because this list is what decides
 * whether `venn check` and `venn build` exit 1. `description`, `license` and
 * `authors` are what a registry will be handed; `edition` is what the manifest
 * example in the guide taught people to write, and removing it from here
 * turned every project that followed the guide red with no way to have known.
 */
const TABLES: Readonly<Record<string, readonly string[] | undefined>> = {
  package: ["name", "version", "description", "license", "authors", "edition"],
  lib: ["name", "path"],
  bin: ["name", "path"],
  workspace: ["members", "exclude", "default-members", "package", "dependencies"],
  tooling: ["manager"],
  format: ["indent", "tabs", "organize", "sort"],
  dependencies: undefined,
  "dev-dependencies": undefined,
  patch: undefined,
  profile: undefined,
  env: undefined,
  paths: undefined,
};

/**
 * Every table and key in a `venn.toml` that nothing reads.
 *
 * A manifest is exactly where silent acceptance hurts: somebody writes
 * `[runner] workers = 4`, sees no complaint, and believes their suite runs four
 * wide for the rest of the project's life. Two tables the specification taught
 * did not exist at all, and neither had any effect.
 *
 * @param content The manifest as written, so what is reported can point at the
 * line it is written on.
 * @returns One entry per stray table or key, in the order they were parsed.
 */
export function strayManifestKeys(content: string): StrayKey[] {
  const lines = content.split(/\r?\n/);
  const found: StrayKey[] = [];
  for (const [table, value] of Object.entries(parseToml(content))) {
    if (!(table in TABLES)) found.push({ path: table, line: lineOf(lines, table) });
    else found.push(...strayIn({ table, value, lines }));
  }
  return found;
}

function strayIn(args: { table: string; value: unknown; lines: readonly string[] }): StrayKey[] {
  const known = TABLES[args.table];
  if (!known) return [];
  const tables = Array.isArray(args.value) ? args.value : [args.value];
  return tables.flatMap((one) =>
    keysOf(one)
      .filter((key) => !known.includes(key))
      .map(stray),
  );

  function stray(key: string): StrayKey {
    return { path: `${args.table}.${key}`, line: lineOf(args.lines, args.table, key) };
  }
}

function keysOf(value: unknown): string[] {
  return typeof value === "object" && value !== null ? Object.keys(value) : [];
}

const HEADER = /^\s*\[/;
const KEY = /^\s*"?([A-Za-z_][\w-]*)"?\s*=/;

/** Where a table, or one of its keys, is written. */
function lineOf(lines: readonly string[], table: string, key?: string): number {
  const header = lines.findIndex((line) => line.trim().startsWith(`[${table}`));
  if (key === undefined) return Math.max(header + 1, 1);
  for (let at = header + 1; at < lines.length; at += 1) {
    if (HEADER.test(lines[at] as string)) break;
    if (KEY.exec(lines[at] as string)?.[1] === key) return at + 1;
  }
  return Math.max(header + 1, 1);
}
