/** Strict equality with no coercion: "99.00" (string) never equals 99 (number). */
export function strictEquals(left: unknown, right: unknown): boolean {
  return left === right;
}
