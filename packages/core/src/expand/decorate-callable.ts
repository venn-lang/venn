import type { Closure, EvalEnv } from "../expr/index.js";
import { invoke, isClosure, nativeFn } from "../expr/index.js";
import { DecoEnv, HookEnv } from "./deco/index.js";
import { type Decorations, readDecorations } from "./decorations.js";

/** A call, reduced to the one thing a middleware needs: values in, value out. */
type Call = (values: readonly unknown[]) => unknown;

/**
 * The callable a decorated `fn` binds to: its own body with every `.wrap`,
 * `.before` and `.after` a `deco` asked for already around it.
 *
 * An untouched function is handed straight back, so nothing pays for a feature
 * it did not use.
 *
 * Each hook is re-seated here rather than where it was written, because this is
 * the first moment both halves of what it can see exist: the `deco` body it
 * closed over, and the program it will run in. Written, it had only the first.
 *
 * @param args.node The declaration, for the hooks a decorator left on it.
 * @param args.base What the declaration means undecorated.
 * @param args.program The scope the call happens in, which is what lets a hook
 * reach a verb. Absent where there is no program yet, and then a hook sees only
 * the body it was written in, as it always did.
 */
export function decorateCallable(args: {
  node: object;
  base: unknown;
  program?: EvalEnv;
}): unknown {
  const found = readDecorations(args.node);
  if (!found) return args.base;
  const around = seated(found, args.program);
  const chain = wrapChain(around.wrap, args.base);
  return nativeFn((values) => aroundCall({ chain, around, values }));
}

/** Every hook, each seeing the program it is about to run in. */
function seated(around: Decorations, program: EvalEnv | undefined): Decorations {
  if (!program) return around;
  const inside = (hook: unknown) => reseat(hook, program);
  return {
    wrap: around.wrap.map(inside),
    before: around.before.map(inside),
    after: around.after.map(inside),
  };
}

/**
 * One hook, with the program behind the body it closed over.
 *
 * Only a closure a `deco` body made is re-seated. Anything else on the list
 * came from somewhere with its own idea of what a name means, and putting the
 * program behind it would change that.
 */
function reseat(hook: unknown, program: EvalEnv): unknown {
  if (!isClosure(hook)) return hook;
  const closure = hook as Closure;
  if (!(closure.env instanceof DecoEnv)) return hook;
  return { ...closure, env: new HookEnv(closure.env, program) };
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
