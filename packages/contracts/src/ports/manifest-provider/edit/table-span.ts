/** Where a table's entries live in a manifest's lines. */
export interface TableSpan {
  /** The line holding `[name]`. */
  header: number;
  /** First line after the header, and the line after the table's last entry. */
  from: number;
  to: number;
}

/**
 * Where a `[table]` is written, or undefined when the file has none.
 *
 * Found by reading lines rather than by re-serialising the parse tree. A
 * manifest carries its author's comments, blank lines and chosen order, and
 * rebuilding it from a tree would throw all of that away.
 */
export function tableSpan(lines: readonly string[], name: string): TableSpan | undefined {
  const header = lines.findIndex((line) => line.trim() === `[${name}]`);
  if (header < 0) return undefined;
  let to = header + 1;
  for (let at = header + 1; at < lines.length; at++) {
    if (lines[at]?.trimStart().startsWith("[")) break;
    if (lines[at]?.trim() !== "") to = at + 1;
  }
  return { header, from: header + 1, to };
}

/** The key a `key = value` line writes, or undefined for a comment or a blank. */
export function keyOf(line: string): string | undefined {
  const text = line.trim();
  if (text === "" || text.startsWith("#") || text.startsWith("[")) return undefined;
  const equals = text.indexOf("=");
  return equals < 0
    ? undefined
    : text
        .slice(0, equals)
        .trim()
        .replace(/^["']|["']$/g, "");
}
