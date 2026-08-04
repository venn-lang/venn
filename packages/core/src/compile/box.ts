/**
 * A captured binding's storage.
 *
 * A slot ordinarily holds the value. One a closure captured holds a cell
 * instead, and the binding mints a fresh one every time it runs: that is what
 * gives each pass of a loop a place of its own, and what lets a closure and the
 * body that made it write through to each other.
 *
 * Which slots those are is decided while the body is compiled, so nothing here
 * asks at run time: a binding gets the writer its own slot needs, once.
 */

import { type Frame, writeSlot } from "../expr/index.js";
import type { Thunk } from "./compile.types.js";
import { boxed, type LexScope } from "./lex-scope.js";

/**
 * What a binding writes into its slot: the value, or a cell holding it.
 *
 * @param value The thunk for the value being bound.
 * @param scope The block the binding is written in.
 * @param at The slot it binds.
 * @returns The thunk to store, which is the one given when nothing captured it.
 */
export function boundValue(value: Thunk, scope: LexScope, at: number): Thunk {
  if (!boxed(scope, at)) return value;
  return (frame) => ({ value: value(frame) });
}

/**
 * How a binding fills a slot whose value the compiler has no thunk for: the
 * item of a `forEach` pass, a `repeat` index, what a `match` arm named.
 *
 * @param scope The block the binding is written in.
 * @param at The slot it binds.
 * @returns A writer that binds the slot afresh each time it is called.
 */
export function slotBinder(scope: LexScope, at: number): (frame: Frame, value: unknown) => void {
  if (!boxed(scope, at)) return (frame, value) => writeSlot(frame, at, value);
  return (frame, value) => writeSlot(frame, at, { value });
}
