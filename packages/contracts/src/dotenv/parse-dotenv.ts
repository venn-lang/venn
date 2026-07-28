/**
 * Read a `.env` file: `NAME=value`, one per line.
 *
 * Deliberately small. It understands comments, blank lines, an `export `
 * prefix, and quotes around a value that needs them. No variable expansion:
 * `${OTHER}` is left alone, because Venn already interpolates in its own
 * strings and two syntaxes for one idea is how people get surprised.
 *
 * @returns every name found, later lines winning over earlier ones.
 */
export function parseDotenv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const entry = readLine(line);
    if (entry) out[entry.name] = entry.value;
  }
  return out;
}

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function readLine(line: string): { name: string; value: string } | undefined {
  if (/^\s*(#|$)/.test(line)) return undefined;
  const match = LINE.exec(line);
  if (!match?.[1]) return undefined;
  return { name: match[1], value: unquote((match[2] ?? "").trim()) };
}

/** A quoted value keeps its spaces and its `#`; an unquoted one stops at a comment. */
function unquote(raw: string): string {
  const quoted = /^(['"])([\s\S]*)\1$/.exec(raw);
  if (quoted) return quoted[2] as string;
  return (raw.split(" #")[0] ?? "").trim();
}
