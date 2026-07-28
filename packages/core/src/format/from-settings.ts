import type { FormatOptions } from "./format.types.js";

/** The shape of the `[format]` table, loose enough for a parsed TOML record. */
export interface FormatTable {
  indent?: unknown;
  tabs?: unknown;
  organize?: unknown;
  sort?: unknown;
}

/**
 * Map the raw `[format]` table of `venn.toml` onto formatter options. Keys the
 * project did not set are dropped, so the defaults survive the merge.
 */
export function formatOptionsFrom(settings: FormatTable | undefined): Partial<FormatOptions> {
  const table: FormatTable = settings ?? {};
  return prune({
    indentWidth: numberOf(table.indent),
    useTabs: booleanOf(table.tabs),
    organizeHeader: booleanOf(table.organize),
    sortHeader: booleanOf(table.sort),
  });
}

function prune(options: Partial<FormatOptions>): Partial<FormatOptions> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<FormatOptions>;
}

function numberOf(value: unknown): number | undefined {
  const parsed = Number(value);
  return value === undefined || Number.isNaN(parsed) ? undefined : parsed;
}

function booleanOf(value: unknown): boolean | undefined {
  return value === undefined ? undefined : value === true || value === "true";
}
