/**
 * What a read by position answers: `xs[i]`, `s[i]`, and the two things the
 * checker cannot promise about either.
 *
 * It lived in `inferIndex` and answered the element type flat, which was two
 * wrong promises in one line. The first was that something is always there:
 * `["a"][5]` is `null` at run time, and the checker knowing better is why
 * `if raw == null` was deleted under VN3020 as a branch that could never run,
 * which left no way at all to bounds-check a read. The second was that a list of
 * unlike things holds one of them at any position, which refuses `-e[1]` on a
 * pair, and a pair is what `entries`, `zip` and `pairwise` all hand back.
 */

import { isNothing } from "./nothing.js";
import { DYNAMIC, NULL, STRING, type Type, union } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * The type a position read answers with, for a receiver that holds positions.
 *
 * @param receiver The pruned type being read into.
 * @param write Whether an assignment is writing through this read. A write is
 * the other question: `xs[0] = 5` puts a value at a position rather than finding
 * out what is there, and offering it `T | null` would have left the element type
 * of `let xs = []` unsolved for ever, since picking a union member never binds a
 * variable.
 * @returns The type, or nothing at all for a receiver that holds no positions
 * and is read by name instead.
 */
export function positionType(receiver: Type, write: boolean): Type | undefined {
  const text = receiver.kind === "prim" && receiver.name === "string";
  if (receiver.kind !== "list" && !text) return undefined;
  const held = receiver.kind === "list" ? receiver.element : STRING;
  return write ? held : atAPosition(held);
}

/**
 * What one position holds, said only as far as this checker can support it.
 *
 * Three answers, and the first two are silence. Something already unknown stays
 * bare: a `dynamic` allows the nothing without being told, and `dynamic | null`
 * says less than `dynamic` while making every union member answer for itself, so
 * `fits(null, number)` starts refusing everything the unknown was there to
 * allow. An unsolved variable is the element of `let xs = []`, which the reads
 * and writes around it are still teaching, and a union member is picked without
 * ever binding one.
 *
 * A union of unlike things is the pair. `entries`, `zip` and `pairwise` all hand
 * theirs back as `list<A | B>`, since there is no tuple here to say that item 0
 * is the A and item 1 is the B, so answering `A | B` says the second item of a
 * pair may be its key. That refuses `sortBy(e => -e[1])` on a program that is
 * right, in three of this repository's own examples, and went unnoticed only
 * while nothing walked into a lambda to read it.
 *
 * A union that already carries the nothing is not that case: it is a declared
 * nullable element, `list<string | null>`, where every position holds the same
 * two possibilities and the guard the reader has to write is the same guard.
 */
function atAPosition(held: Type): Type {
  const t = prune(held);
  if (t.kind === "dynamic" || t.kind === "var") return held;
  if (t.kind === "union") return t.members.some(isNothing) ? held : DYNAMIC;
  return union([held, NULL]);
}
