import { invoke, nativeFn } from "../expr/index.js";
import { type Decorations, readDecorations } from "./decorations.js";

/** A call, reduced to the one thing a middleware needs: values in, value out. */
type Call = (values: readonly unknown[]) => unknown;

/**
 * The callable a decorated `fn` binds to: its own body with every `.wrap`,
 * `.before` and `.after` a `deco` asked for already around it.
 *
 * An untouched function is handed straight back, so nothing pays for a feature
 * it did not use.
 */
export function decorateCallable(node: object, base: unknown): unknown {
  const around = readDecorations(node);
  if (!around) return base;
  const chain = wrapChain(around.wrap, base);
  return nativeFn((values) => aroundCall({ chain, around, values }));
}

function aroundCall(args: {
  chain: Call;
  around: Decorations;
  values: readonly unknown[];
}): unknown {
  for (const fn of args.around.before) invoke(fn, [args.values]);
  const result = args.chain(args.values);
  for (const fn of args.around.after) invoke(fn, [args.values, result]);
  return result;
}

/** The first-written wrap ends up outermost: it decides whether the rest runs. */
function wrapChain(wraps: readonly unknown[], base: unknown): Call {
  let next: Call = (values) => invoke(base, values);
  for (let at = wraps.length - 1; at >= 0; at -= 1) next = oneWrap(wraps[at], next);
  return next;
}

function oneWrap(wrap: unknown, inner: Call): Call {
  const through = nativeFn((given) => inner(passedOn(given)));
  return (values) => invoke(wrap, [through, values]);
}

/** `call(args)` passes the list straight along; `call(a, b)` passes both. */
function passedOn(given: readonly unknown[]): readonly unknown[] {
  const first = given[0];
  if (given.length === 1 && Array.isArray(first)) return first;
  return given;
}
