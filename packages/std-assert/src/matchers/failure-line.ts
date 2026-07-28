/** A failure title is one line. Past this, a value is summarised instead. */
const LIMIT = 44;

/**
 * Builds the line a failure leads with: `expected <subject> <relation> <other>`.
 *
 * Both sides render to the same level of detail: one spelled out next to one
 * summarised reads as a reporter glitch rather than a comparison. Nothing is
 * lost, the full values travel in the problem's diff.
 */
export function failureLine(args: { subject: unknown; relation: string; other: unknown }): string {
  const [left, right] = pair(args.subject, args.other);
  return `expected ${left} ${args.relation} ${right}`;
}

function pair(subject: unknown, other: unknown): [string, string] {
  const left = render(subject);
  const right = render(other);
  if (left.length <= LIMIT && right.length <= LIMIT) return [left, right];
  return [summarize(subject), summarize(other)];
}

/** Strings quoted, maps and lists as compact JSON. Never `[object Object]`. */
function render(value: unknown): string {
  if (value === undefined) return "absent";
  if (value === null) return "null";
  if (typeof value === "function") return "fn";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  return json(value);
}

function summarize(value: unknown): string {
  if (typeof value === "string") return `${JSON.stringify(value.slice(0, LIMIT))}…`;
  if (typeof value === "object" && value !== null) return shapeOf(value);
  return render(value);
}

function shapeOf(value: object): string {
  if (Array.isArray(value)) return `a list of ${value.length} ${plural("item", value.length)}`;
  const count = Object.keys(value).length;
  return `a map with ${count} ${plural("field", count)}`;
}

function json(value: object): string {
  try {
    return JSON.stringify(value) ?? shapeOf(value);
  } catch {
    return shapeOf(value);
  }
}

function plural(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}
