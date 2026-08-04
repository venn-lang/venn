import type { Case, Placement } from "./same-everywhere.types.js";

/**
 * Read one corpus file: the header lines, then the body.
 *
 * A header line is `# excludes`, `# differs` or `# open`, then a placement, then
 * the reason. Every one carries a reason: two of them are claims about the
 * language rather than about today's behaviour, the third names an issue, and a
 * claim with no reason is one nobody can check. Everything after the last header
 * line is the body, verbatim.
 *
 * @param name The file name without `.vn`, which names the case in a failure.
 * @param text The whole file.
 * @returns The case, ready to be placed and driven.
 * @throws Error when a header line names something that is not a placement, or
 * gives no reason for what it claims.
 */
export function parseCase(name: string, text: string): Case {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const head = lines.filter(isHeader);
  const body = lines.slice(head.length).join("\n").trim();
  return {
    name,
    body,
    excludes: claimed(name, head, "excludes"),
    differs: claimed(name, head, "differs"),
    open: claimed(name, head, "open"),
  };
}

const isHeader = (line: string): boolean => line.startsWith("#");

const PLACEMENTS = new Set<string>(["top", "fnDecl", "fnExpr", "fragment"]);

function claimed(name: string, head: string[], word: string): ReadonlyMap<Placement, string> {
  const found = new Map<Placement, string>();
  for (const line of head) {
    const parts = line.slice(1).trim().split(/\s+/);
    if (parts[0] !== word) continue;
    found.set(placementOf(name, parts[1]), reasonOf(name, line, parts.slice(2)));
  }
  return found;
}

function placementOf(name: string, written: string | undefined): Placement {
  if (written && PLACEMENTS.has(written)) return written as Placement;
  throw new Error(`${name}.vn: "${written}" is not a placement`);
}

function reasonOf(name: string, line: string, rest: readonly string[]): string {
  if (rest.length === 0) throw new Error(`${name}.vn: "${line.trim()}" gives no reason`);
  return rest.join(" ");
}
