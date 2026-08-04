/**
 * Where a closure's free names live, decided where the closure is written.
 *
 * Which binding a `fn` meant is a fact about the place it was written, so it is
 * settled there: each free name of the body gets a way to reach its cell, and
 * making the closure runs that list once. Asking by name at call time cannot
 * answer it, because by then the block that shadowed the name has ended and the
 * pass that bound it has moved on.
 */

import { type Cell, type Frame, readSlot } from "../expr/index.js";
import type { Capture } from "./compile.types.js";
import { bindsName, boxed, capture, freeSlot, type LexScope, rootOf, slotOf } from "./lex-scope.js";

/** Nothing to resolve here: the name is asked for at call time, as before. */
const LATE: Capture = () => undefined;

/**
 * Where each free name of a closure lives, in the order the body reads them.
 *
 * @param free The names the compiled body reads and does not bind.
 * @param scope The block the `fn` is written in.
 * @returns One capture per free name, or `undefined` where there is nothing to
 * resolve: no free names, or a `fn` written outside any function body, whose
 * names the defining environment hands out as cells itself.
 */
export function capturePlan(
  free: readonly string[],
  scope: LexScope,
): readonly Capture[] | undefined {
  rootOf(scope).nested = true;
  if (free.length === 0 || rootOf(scope).free === undefined) return undefined;
  return free.map((name) => captureOf(name, scope));
}

/**
 * A name is one of three things here, and the fourth answer is to wait.
 *
 * A slot of the frame around it; a cell the enclosing body holds outright; or a
 * free name of that body too, which puts it in the enclosing closure's own list
 * and so reaches a binding any number of frames out without walking a chain.
 */
function captureOf(name: string, scope: LexScope): Capture {
  const slot = slotOf(scope, name);
  if (slot !== -1) return fromSlot(scope, slot);
  // Bound further down this body: which slot is settled, but the cell it will
  // hold does not exist yet, so this one name goes on being asked for by name.
  if (bindsName(scope, name)) return LATE;
  const own = rootOf(scope).cellOf?.(name);
  if (own) return () => own;
  const up = freeSlot(scope, name);
  return up === undefined ? LATE : (env) => (env as Frame).up?.[up];
}

/**
 * The cell in the frame's slot, which the binding minted for this pass.
 *
 * The capture is recorded whether or not the slot holds a cell yet: the first
 * pass over a body is what discovers the captures, and the answers it compiled
 * are thrown away for a second that knows them.
 */
function fromSlot(scope: LexScope, slot: number): Capture {
  capture(scope, slot);
  if (!boxed(scope, slot)) return LATE;
  return (env) => readSlot(env as Frame, slot) as Cell;
}
