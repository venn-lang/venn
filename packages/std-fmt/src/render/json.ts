/**
 * Renders a value as JSON text.
 *
 * A value JSON cannot express (a cycle, a BigInt) falls back to `String(value)`
 * instead of throwing: formatting is not where a run should die.
 *
 * @param value What to render.
 * @param spaces Spaces per level of nesting. 0 puts it all on one line.
 * @returns The JSON text.
 */
export function toJson(value: unknown, spaces = 2): string {
  try {
    return JSON.stringify(value, null, spaces) ?? String(value);
  } catch {
    return String(value);
  }
}
