/**
 * Structural equality over the language's values.
 *
 * A body, a row or a list of ids is a value, not a handle, so two built the
 * same way are equal. Anything that is not a plain map or a list (dates, plugin
 * objects, closures) still compares by identity: guessing at their innards
 * would be worse than being strict.
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  return equal(a, b, []);
}

/**
 * `open` holds the containers already entered on the way down, so a value that
 * contains itself cannot recurse until the stack gives out. Two containers
 * already open count as equal, the way one cycle matches another.
 */
function equal(a: unknown, b: unknown, open: readonly unknown[]): boolean {
  if (a === b) return true;
  const openA = open.includes(a);
  const openB = open.includes(b);
  if (openA || openB) return openA && openB;
  if (Array.isArray(a) || Array.isArray(b)) return sameList(a, b, open);
  if (!isMap(a) || !isMap(b)) return false;
  return sameMap(a, b, open);
}

function sameList(a: unknown, b: unknown, open: readonly unknown[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const next = [...open, a, b];
  return a.every((item, index) => equal(item, b[index], next));
}

/**
 * A field set to nothing is not a field. `{ id: 1, ref: absent }` prints, and
 * travels over the wire, exactly like `{ id: 1 }`, so the two compare equal.
 */
function sameMap(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  open: readonly unknown[],
): boolean {
  const keys = presentKeys(a);
  if (keys.length !== presentKeys(b).length) return false;
  const next = [...open, a, b];
  return keys.every((key) => equal(a[key], b[key], next));
}

function presentKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => value[key] !== undefined);
}

function isMap(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
