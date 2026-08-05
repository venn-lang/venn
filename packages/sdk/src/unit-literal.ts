/**
 * The base field each of the language's unit literals carries.
 *
 * A `kind` on its own does not make one. `kind` is how this language spells a
 * union, so `{ kind: "size", label: "x" }` is an ordinary map somebody wrote on
 * purpose, and a guard that asked only for the word would read it as a size and
 * answer `.label` with nothing. The field has to be there, and it has to hold a
 * finite number.
 *
 * A symbol brand would be shorter and is not an option: `structuredClone` drops
 * symbols, and a value crosses that boundary on its way through a plugin.
 */
const BASE_FIELD: Record<string, string> = {
  duration: "ms",
  size: "bytes",
  percent: "ratio",
  instant: "epochMs",
};

/**
 * The number a unit literal holds, in its base unit, when it is the kind asked
 * for.
 *
 * This is recognition and not acceptance: `1s / 0` evaluates to a duration
 * whose `ms` is `Infinity`, and that is still a length of time gone wrong
 * rather than an ordinary map. A renderer has to write it as `Infinityms`. What
 * a clock will accept is a narrower question, asked by {@link Duration} and by
 * the compiler's `durationMs`, both of which refuse a non-finite answer.
 *
 * The SDK holds its own copy of a shape `@venn-lang/core` owns, because a
 * plugin package may never import the compiler. `duration-agrees.test.ts` in
 * the runtime holds the two against each other.
 *
 * @param value Anything a flow evaluated.
 * @param kind Which literal to read: duration, size, percent or instant.
 * @returns Milliseconds, bytes, a ratio or epoch milliseconds, or `undefined`
 * when the value is not that literal.
 */
export function unitBase(value: unknown, kind: string): number | undefined {
  if (value === null || typeof value !== "object" || !("kind" in value)) return undefined;
  if (value.kind !== kind) return undefined;
  const field = BASE_FIELD[kind];
  if (field === undefined || !(field in value)) return undefined;
  // The key is computed, so the compiler cannot follow the `in` above; the read
  // is checked, only not in a way it can see.
  const base: unknown = (value as Record<string, unknown>)[field];
  return typeof base === "number" ? base : undefined;
}

/**
 * Whether this is one of the four values the language writes as a literal and
 * the host sees as a map: `30s`, `2mb`, `50%` and a moment.
 *
 * A renderer asks this to know it has reached a leaf. Walking into one is how
 * `250ms` came to be written `{"kind":"duration","ms":250}` in four of the five
 * `fmt` formats.
 *
 * @param value Anything a flow evaluated.
 * @returns True for a well formed duration, size, percent or instant.
 */
export function isUnitLiteral(value: unknown): boolean {
  if (value === null || typeof value !== "object" || !("kind" in value)) return false;
  return typeof value.kind === "string" && unitBase(value, value.kind) !== undefined;
}
