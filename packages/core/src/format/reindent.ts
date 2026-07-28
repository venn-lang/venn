const OPEN = /[{[(]/g;
const CLOSE = /[}\])]/g;

/**
 * Re-indent by bracket depth. Venn statements are newline terminated, so this
 * only ever rewrites the leading whitespace of a line. It never joins or splits
 * lines, which makes it idempotent by construction.
 *
 * @param unit The string for one indent level, either spaces or a tab.
 */
export function reindent(lines: readonly string[], unit: string): string[] {
  const out: string[] = [];
  let depth = 0;
  for (const line of lines) {
    const stripped = stripLiterals(line).trim();
    const level = Math.max(0, depth - leadingClosers(stripped));
    const trimmed = line.trim();
    out.push(trimmed === "" ? "" : unit.repeat(level) + trimmed);
    depth = Math.max(0, depth + count(stripped, OPEN) - count(stripped, CLOSE));
  }
  return out;
}

// Brackets inside strings or comments must not move the depth.
function stripLiterals(line: string): string {
  return line.replace(/"(\\.|[^"\\])*"/g, '""').replace(/#.*$/, "");
}

function leadingClosers(stripped: string): number {
  return /^[}\])]*/.exec(stripped)?.[0].length ?? 0;
}

function count(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}
