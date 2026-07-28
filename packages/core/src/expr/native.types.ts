/**
 * Invoke a Venn callable (a closure or another native fn) with values.
 *
 * The fixed arities are part of the contract because the built-in methods are
 * the hottest callers there are: `map` and `reduce` call once per element, and
 * an argument list would be one array per element. Injected rather than
 * imported, so a method never depends on the invoker itself.
 */
export interface Invoke {
  (fn: unknown, values: readonly unknown[]): unknown;
  one(fn: unknown, a: unknown): unknown;
  two(fn: unknown, a: unknown, b: unknown): unknown;
  three(fn: unknown, a: unknown, b: unknown, c: unknown): unknown;
}

/** A built-in method on a native value: `[1,2].map`, `"a".upper`. */
export type Method = (receiver: never, invoke: Invoke) => unknown;

const NATIVE = Symbol("venn.native");

/** A callable backed by a host function rather than by Venn source. */
export interface NativeFn {
  readonly [NATIVE]: true;
  call(values: readonly unknown[]): unknown;
}

/** Whether this value is a host-backed callable. */
export function isNativeFn(value: unknown): value is NativeFn {
  return typeof value === "object" && value !== null && NATIVE in value;
}

/**
 * Wrap a host function so the language can call it.
 *
 * The wrapper takes the whole argument list: arity is the host function's own
 * business, and a plugin verb reads what it needs and ignores the rest.
 */
export function nativeFn(call: (values: readonly unknown[]) => unknown): NativeFn {
  return { [NATIVE]: true, call };
}
