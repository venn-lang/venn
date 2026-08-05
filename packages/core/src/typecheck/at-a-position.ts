/**
 * What a read by position answers: `xs[i]`, `s[i]`, `m["name"]`, and the two
 * things the checker cannot promise about any of them.
 *
 * Something is not always there. `["a"][5]` is `null` at run time, so a read
 * answers `T | null`, which is what makes `if raw == null` a branch that can run
 * and a read past the end something the reader is able to guard.
 *
 * And a list of unlike things does not hold one of them at every position. That
 * is true of a declared `list<string | null>` and false of a pair, so a pair
 * carries which member each of its positions holds and nothing here has to
 * guess. The guess was `dynamic`, and it answered for every `list<A | B>` a
 * reader wrote by hand as well.
 */

import type { Expr, Index } from "../generated/ast.js";
import { scanInterpolations } from "../interpolation/index.js";
import { positionKey } from "../value/index.js";
import { indexAsWritten } from "./as-written.js";
import type { Infer } from "./infer.js";
import { memberRead } from "./member-read.js";
import type { MemberRead } from "./member-read.types.js";
import { mayBeNothing, throughNothing } from "./read-through-nothing.js";
import { DYNAMIC, NULL, STRING, type Type, union } from "./type.types.js";
import { prune } from "./unify.js";
import { isWritten } from "./written-into.js";

/**
 * `xs[0]`, `m["name"]`, and the same question the dot spelling asks.
 *
 * A position is read as one wherever the receiver holds positions, so `xs[0]`
 * and `xs["0"]` are the same element with the same type, and `s[0]` is the
 * character it reads at run time rather than a member nobody declared.
 * Everything else the source spelled out is a member read written with
 * brackets, and is typed as one.
 *
 * A key the run works out (`m[k]`, `stats[stat]`) is nobody's mistake and stays
 * `dynamic`: that is what reading a map by a computed key means. The receiver is
 * not excused with it. A read through a value that may be nothing reports
 * whichever way the read was spelled, because `xs[9][0]` and `xs[9].len` are one
 * question, and the position spelling was the one that stayed quiet.
 *
 * @param receiver The pruned type being read into.
 * @param expr The read, so the index and the text the reader wrote are to hand.
 * @param infer Where mismatches go.
 * @returns What the read answers with.
 */
export function readAt(receiver: Type, expr: Index, infer: Infer): Type {
  const name = writtenKey(expr.index);
  const wrote = name ?? (expr.index.$type === "NumberLit" ? expr.index.raw : undefined);
  const at = wrote === undefined ? undefined : positionKey(wrote);
  const spot = name === undefined || at !== undefined;
  const held = spot ? positionType(receiver, at, isWritten(expr)) : undefined;
  if (held) return held;
  const read = readOf(expr, name, spot);
  if (!read) return DYNAMIC;
  const rest = throughNothing(receiver, read);
  if (!rest) return name === undefined ? DYNAMIC : memberRead(receiver, read, infer);
  infer.ctx.mismatches.push(mayBeNothing(receiver, read));
  return readAt(prune(rest), expr, infer);
}

/**
 * The read, named and spelled.
 *
 * A position has no name to write after a dot, so how it was spelled travels
 * with it: a way out reading `(xs[9] ?? …).0` is not something this language
 * accepts, and every help line here is a promise that it compiles.
 *
 * @returns Nothing when the source is not to hand at all, which is a read there
 * is no way to name in a sentence.
 */
function readOf(expr: Index, name: string | undefined, spot: boolean): MemberRead | undefined {
  const wrote = indexAsWritten(expr.index);
  const named = name ?? wrote;
  if (named === undefined) return undefined;
  const read: MemberRead = { node: expr, name: named, asking: false };
  return spot ? { ...read, spelled: `[${wrote ?? named}]` } : read;
}

/** The key when the source spelled it out, as against one the run works out. */
function writtenKey(index: Expr): string | undefined {
  if (index.$type !== "StringLit") return undefined;
  // A `${…}` inside makes the key a run-time value, and nothing here to be
  // right or wrong about yet.
  return scanInterpolations(index.value).length > 0 ? undefined : index.value;
}

/**
 * The type a position read answers with, for a receiver that holds positions.
 *
 * @param receiver The pruned type being read into.
 * @param at Which position, where the source named one.
 * @param write Whether an assignment is writing through this read. A write is
 * the other question: `xs[0] = 5` puts a value at a position rather than finding
 * out what is there, and offering it `T | null` would have left the element type
 * of `let xs = []` unsolved for ever, since picking a union member never binds a
 * variable.
 * @returns The type, or nothing at all for a receiver that holds no positions
 * and is read by name instead.
 */
function positionType(receiver: Type, at: number | undefined, write: boolean): Type | undefined {
  const text = receiver.kind === "prim" && receiver.name === "string";
  if (receiver.kind !== "list" && !text) return undefined;
  const known = receiver.kind === "list" && at !== undefined ? receiver.positions?.[at] : undefined;
  if (known) return known;
  const held = receiver.kind === "list" ? receiver.element : STRING;
  return write ? held : atAPosition(held);
}

/**
 * What one position holds, said only as far as this checker can support it.
 *
 * Silence, twice over. Something already unknown stays bare: a `dynamic` allows
 * the nothing without being told, and `dynamic | null` says less than `dynamic`
 * while making every union member answer for itself, so `fits(null, number)`
 * starts refusing everything the unknown was there to allow. An unsolved
 * variable is the element of `let xs = []`, which the reads and writes around it
 * are still teaching, and a union member is picked without ever binding one.
 *
 * Everything else answers what it holds and the nothing beside it. A union goes
 * the same way as anything else, because `list<string | null>` already carries
 * its nothing and `list<string | number>` is a reader saying that either may be
 * at any position, which is a promise worth keeping them to.
 */
function atAPosition(held: Type): Type {
  const t = prune(held);
  if (t.kind === "dynamic" || t.kind === "var") return held;
  return union([held, NULL]);
}
