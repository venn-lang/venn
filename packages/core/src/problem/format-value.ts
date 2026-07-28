/** Past this a value stops informing and starts scrolling. */
const LIMIT = 200;

/**
 * One side of a diff, rendered the way the language shows values: strings quoted
 * so `"1"` never reads as `1`, structures as compact JSON. Never `[object
 * Object]`, because a failure that hides what it compared is not a report.
 */
export function formatValue(value: unknown): string {
  if (value === undefined) return "absent";
  if (value === null) return "null";
  if (typeof value === "function") return "fn";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  return json(value);
}

/** Trim for display only. Sameness is decided on the untrimmed rendering. */
export function clamp(text: string): string {
  return text.length <= LIMIT ? text : `${text.slice(0, LIMIT)}…`;
}

function json(value: object): string {
  try {
    return JSON.stringify(value) ?? shapeOf(value);
  } catch {
    // Cyclic, or a BigInt inside: say what it is rather than what it prints as.
    return shapeOf(value);
  }
}

function shapeOf(value: object): string {
  if (Array.isArray(value)) return `a list of ${value.length} ${plural("item", value.length)}`;
  const count = Object.keys(value).length;
  return `a map with ${count} ${plural("field", count)}`;
}

function plural(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}
