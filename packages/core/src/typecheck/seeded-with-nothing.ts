/**
 * A name that starts out holding nothing, and what the first write teaches it.
 *
 * `let a = []` widens: the element is a variable, the first list written into it
 * solves that variable, and the answer is visible everywhere the name is,
 * including above the write and outside the block the write is in. `let b = null`
 * did not, so `b = 3` was `expected null, found number`, naming a type nobody
 * would ever declare as the thing that was wanted.
 *
 * That one rule is why a program could not report why its input was malformed.
 * `try`/`catch` is a statement, so the parsed value cannot leave the block, and
 * the bridge every language writes for it is a `let` above the `try` that the
 * body assigns into. Seeded with `null` the bridge was refused; seeded with `{}`
 * it was refused one line later at the read. You could have the value or you
 * could have the message, and what the survey author shipped was parsing the
 * document twice.
 *
 * So the same mechanism, for the same reason: a variable, solved by the write,
 * shared by every scope that can see the name. A `const` is left alone, since
 * keeping what it was given is the whole of what `const` is for.
 */

import type { LetStmt } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { TypeContext } from "./context.js";
import { isNothing } from "./nothing.js";
import { NULL, type Type, union } from "./type.types.js";

/**
 * The type to bind, for a `let` whose whole value is the word `null`.
 *
 * A variable already solved to `null`, so nothing else in the checker sees any
 * difference: it prunes to `null`, it prints as `null`, `b.foo` still reports
 * that `null` has no such member, and `if b == null` still narrows. The one
 * thing it adds is a place to write the answer into when a write arrives, which
 * a plain `null` has nowhere to put.
 *
 * @param node The binding, as the source wrote it.
 * @param type What its value was inferred to be.
 * @param ctx Where fresh variables come from.
 * @returns The variable to bind, or the type unchanged when this binding is not
 * one that starts out empty.
 */
export function seededWithNothing(node: LetStmt, type: Type, ctx: TypeContext): Type {
  if (node.kind !== "let" || node.declaredType || !ast.isNullLit(node.value)) return type;
  const seed = ctx.fresh();
  seed.ref = NULL;
  return seed;
}

/**
 * Widen a name that held nothing to hold what was just written into it.
 *
 * Written into the variable rather than into the scope, because a scope does not
 * reach far enough: the assignment that matters is inside a `try` block, and
 * every block runs in a child scope whose bindings do not escape. The run writes
 * through to the outer name, so the checker has to as well.
 *
 * The nothing stays in the union, and stays second. It is not a formality: the
 * write may not have happened, which is exactly what a `try` body means, and the
 * reader still has to ask before reading through it. Second because the value is
 * the subject and the absence is the qualifier, so `number | null` reads as "a
 * number, or nothing", which is the order every other nullable in this checker
 * is printed in.
 *
 * @param place The type of the thing being written to, unpruned, since the
 * variable itself is what is being solved.
 * @param value What is being written into it.
 * @returns Whether the name widened, in which case there is nothing to report.
 */
export function widenedByWrite(place: Type, value: Type): boolean {
  if (place.kind !== "var" || !place.ref || !isNothing(place.ref)) return false;
  // A second nothing teaches nothing, and `null | null` is not a type to print.
  if (!isNothing(value)) place.ref = union([value, NULL]);
  return true;
}
