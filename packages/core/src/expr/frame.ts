import type { Closure } from "./closure.types.js";
import type { EvalEnv } from "./eval-env.types.js";

/** Past this many names a function keeps the rest in an array. */
export const INLINE_SLOTS = 3;

/**
 * A function call's own storage: one slot per name it binds.
 *
 * The compiler knows every name a function introduces, so a reference to one
 * becomes a field read instead of a search. A name it does *not* introduce (a
 * top-level binding, a namespace, the prelude) is a cell the closure resolved
 * when it was built, which is an index into `up`.
 *
 * The first three slots are fields rather than an array because almost every
 * function binds three names or fewer, and a frame plus an array is two
 * allocations per call. Beyond three, `rest` holds the remainder.
 *
 * `lookup` stays because a name can still arrive as text: an expression inside
 * `"${…}"` is compiled apart from the body that holds it, so it asks by name.
 * Scanning a handful of parameters beats walking a chain of maps.
 */
export class Frame implements EvalEnv {
  s0: unknown;
  s1: unknown;
  s2: unknown;
  rest: unknown[] | undefined;
  /** The cells this function's free names resolved to, in compile order. */
  readonly up: readonly { value: unknown }[] | undefined;
  /** What a `return` left, for the caller to pick up. Untouched by a body with none. */
  left: unknown;

  constructor(readonly closure: Closure) {
    const body = closure.body;
    this.s0 = undefined;
    this.s1 = undefined;
    this.s2 = undefined;
    this.rest = body.extra === 0 ? undefined : new Array<unknown>(body.extra);
    this.up = closure.up;
    this.left = undefined;
  }

  lookup(name: string): unknown {
    const at = this.closure.body.names.indexOf(name);
    return at === -1 ? this.closure.env.lookup(name) : readSlot(this, at);
  }
}

/** The slot at `at`, wherever it is held. */
export function readSlot(frame: Frame, at: number): unknown {
  if (at === 0) return frame.s0;
  if (at === 1) return frame.s1;
  if (at === 2) return frame.s2;
  return (frame.rest as unknown[])[at - INLINE_SLOTS];
}

/** Write the slot at `at`. Used for the parameters and the body's locals. */
export function writeSlot(frame: Frame, at: number, value: unknown): void {
  if (at === 0) frame.s0 = value;
  else if (at === 1) frame.s1 = value;
  else if (at === 2) frame.s2 = value;
  else (frame.rest as unknown[])[at - INLINE_SLOTS] = value;
}
