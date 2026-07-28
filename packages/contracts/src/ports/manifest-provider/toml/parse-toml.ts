import { cursor, readValue } from "./read-value.js";
import { enterSection, enterTableArray } from "./sections.js";

/**
 * A TOML reader for `venn.toml`: sections, nested `[a.b]`, arrays of tables
 * (`[[bin]]`), `key = value`, strings, numbers, bools, arrays and inline tables.
 *
 * Not a full TOML parser. No dates, no multi-line strings, no dotted keys.
 * `venn.toml` is our own format, so the subset is a decision rather than a
 * shortfall.
 *
 * @returns the root table. Malformed lines are skipped, never thrown on.
 */
export function parseToml(content: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let section = root;
  for (const raw of content.split(/\r?\n/)) {
    const line = stripComment(raw).trim();
    if (line === "") continue;
    if (line.startsWith("[")) section = openSection(root, line);
    else assign(section, line);
  }
  return root;
}

/** `[[bin]]` appends another table, `[bin]` opens the one and only. */
function openSection(root: Record<string, unknown>, line: string): Record<string, unknown> {
  if (line.startsWith("[[")) {
    return enterTableArray(root, line.slice(2, line.indexOf("]]")));
  }
  return enterSection(root, line.slice(1, line.indexOf("]")));
}

function stripComment(line: string): string {
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") quote = quote === ch ? undefined : (quote ?? ch);
    else if (ch === "#" && !quote) return line.slice(0, i);
  }
  return line;
}

function assign(section: Record<string, unknown>, line: string): void {
  const eq = line.indexOf("=");
  if (eq < 0) return;
  const key = line
    .slice(0, eq)
    .trim()
    .replace(/^["']|["']$/g, "");
  section[key] = readValue(cursor(line.slice(eq + 1)));
}
