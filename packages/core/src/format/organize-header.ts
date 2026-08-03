interface Entry {
  comments: string[];
  line: string;
}

interface Header {
  head: string[];
  entries: Entry[];
  floating: string[];
  rest: string[];
}

/**
 * Gather the `import` lines into one block under `module`. A comment sitting
 * directly on top of a line travels with it; a comment separated by a blank
 * line is left where the header begins, so nothing is silently re-attached to
 * the wrong statement.
 */
export function organizeHeader(lines: readonly string[], sort: boolean): string[] {
  const header = split(lines);
  if (header.entries.length === 0) return [...lines];
  const head = header.head.length > 0 ? [...header.head, ""] : [];
  const imports = group(header.entries, sort);
  return [...head, ...imports, ...header.floating, ...header.rest];
}

function split(lines: readonly string[]): Header {
  const header: Header = { head: [], entries: [], floating: [], rest: [] };
  let pending: string[] = [];
  let index = 0;
  for (; index < lines.length; index++) {
    const line = (lines[index] ?? "").trim();
    if (isImport(line)) {
      header.entries.push({ comments: pending, line });
      pending = [];
    } else if (/^module\s/.test(line)) {
      header.head.push(...pending, line);
      pending = [];
    } else if (line.startsWith("#")) pending.push(line);
    else if (line === "") pending = park(header, pending);
    else break;
  }
  header.rest = [...pending, ...lines.slice(index)];
  return header;
}

// A comment block cut off by a blank line belongs to nobody: keep it in place.
function park(header: Header, pending: string[]): string[] {
  if (pending.length > 0)
    (header.entries.length === 0 ? header.head : header.floating).push(...pending);
  return [];
}

function group(entries: readonly Entry[], sort: boolean): string[] {
  const ordered = sort ? [...entries].sort((a, b) => a.line.localeCompare(b.line)) : entries;
  if (ordered.length === 0) return [];
  return [...ordered.flatMap((entry) => [...entry.comments, entry.line]), ""];
}

function isImport(line: string): boolean {
  return /^(pub\s+)?import\s/.test(line);
}
