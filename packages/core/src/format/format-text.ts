import { DEFAULT_FORMAT, type FormatOptions } from "./format.types.js";
import { organizeHeader } from "./organize-header.js";
import { reindent } from "./reindent.js";

/**
 * Format a `.vn` source: group the header, then re-indent. Line-oriented by
 * design, so it never joins or splits lines. That makes it idempotent, and a
 * one-line block stays on one line.
 */
export function formatText(source: string, options?: Partial<FormatOptions>): string {
  const settings = { ...DEFAULT_FORMAT, ...options };
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const organized = settings.organizeHeader
    ? organizeHeader(lines, settings.sortHeader)
    : [...lines];
  return reindent(organized, unitOf(settings)).join(eol);
}

function unitOf(options: FormatOptions): string {
  return options.useTabs ? "\t" : " ".repeat(Math.max(1, options.indentWidth));
}
