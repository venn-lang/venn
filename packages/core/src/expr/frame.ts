import { buildProblem, CODES } from "../codes/index.js";
import { ProblemError, UNLOCATED } from "../problem/index.js";
import type { Cell } from "./cell.types.js";
import { hasCells } from "./cell.types.js";
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
 * `lookup` stays for the one name the compiler cannot place: a closure written
 * above the `let` that binds the name it reads. Scanning a handful of names
 * beats walking a chain of maps, and everything else is an index by then.
 */
export class Frame implements EvalEnv {
  s0: unknown;
  s1: unknown;
  s2: unknown;
  rest: unknown[] | undefined;
  /**
   * The cells this function's free names resolved to, in compile order. An
   * entry is absent for a name that had no cell yet where the `fn` was written.
   */
  readonly up: readonly (Cell | undefined)[] | undefined;
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

  /**
   * The outermost slot with this name, or the same question one frame out.
   *
   * Which slot a closure meant is a question about where it was written, and
   * this asks by name at call time, so it cannot answer it. It is no longer
   * asked to: a closure resolves its free names where it is written and reaches
   * them through `up`. What is left over is a closure written above the `let`
   * that binds the name it reads, where the binding has no cell yet and the
   * outermost slot of that spelling is the answer the source gives.
   */
  lookup(name: string): unknown {
    const body = this.closure.body;
    const at = body.names.indexOf(name);
    if (at === -1) return this.closure.env.lookup(name);
    const held = readSlot(this, at);
    return body.boxed?.has(at) ? (held as Cell | undefined)?.value : held;
  }
}

/** The slot at `at`, wherever it is held. */
export function readSlot(frame: Frame, at: number): unknown {
  if (at === 0) return frame.s0;
  if (at === 1) return frame.s1;
  if (at === 2) return frame.s2;
  if (at < 0) throw noSlot();
  return (frame.rest as unknown[])[at - INLINE_SLOTS];
}

/** Write the slot at `at`. Used for the parameters and the body's locals. */
export function writeSlot(frame: Frame, at: number, value: unknown): void {
  if (at === 0) frame.s0 = value;
  else if (at === 1) frame.s1 = value;
  else if (at === 2) frame.s2 = value;
  else if (at < 0) throw noSlot();
  else (frame.rest as unknown[])[at - INLINE_SLOTS] = value;
}

/**
 * Write a name the compiled body does not bind, wherever it is bound.
 *
 * The same binding a closure captured, which is what an assignment writes
 * everywhere else: `runAssign` reaches it through `scope.cell`, and a body
 * nested in another reaches it through the frame that holds the slot. Kept off
 * the slot path because it is the uncommon one, and the common one is an index.
 *
 * @param frame The frame the assignment is written in.
 * @param name The name being written.
 * @param value What to write.
 * @throws ProblemError `VN3021` when nothing anywhere binds the name.
 */
export function writeNamed(frame: Frame, name: string, value: unknown): void {
  let env: EvalEnv = frame;
  while (env instanceof Frame) {
    // The outermost, to match what `lookup` reads. A write and a read of one
    // name in one frame must reach one slot, whichever is the right one.
    const at = env.closure.body.names.indexOf(name);
    if (at !== -1) {
      intoSlot(env, at, value);
      return;
    }
    env = env.closure.env;
  }
  if (!hasCells(env)) throw nowhere(name);
  env.cell(name).value = value;
}

/**
 * A captured slot holds a cell, and a write goes through it rather than over
 * it, so the closures already holding it see the new value.
 *
 * A cell that is not there yet is the block that never ran: the slot takes one,
 * which is what the binding would have done had it been reached.
 */
function intoSlot(frame: Frame, at: number, value: unknown): void {
  if (!frame.closure.body.boxed?.has(at)) {
    writeSlot(frame, at, value);
    return;
  }
  const cell = readSlot(frame, at) as Cell | undefined;
  if (cell) cell.value = value;
  else writeSlot(frame, at, { value });
}

/**
 * A slot number no name has.
 *
 * Only an inconsistency inside the compiler produces one, and the point is that
 * it arrives as a Problem: `rest[-4]` was a host `TypeError` on a body with four
 * locals and a discarded write on a body with five.
 */
function noSlot(): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3021_NOT_A_PLACE,
      span: UNLOCATED,
      title: "There is nothing here to write to.",
    }),
  );
}

function nowhere(name: string): ProblemError {
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3021_NOT_A_PLACE,
      span: UNLOCATED,
      title: `Nothing here binds "${name}", so there is nowhere to write it.`,
    }),
  );
}
