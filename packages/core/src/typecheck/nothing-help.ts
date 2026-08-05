import type { AstNode } from "langium";
import * as ast from "../generated/ast.js";
import type { TypeMismatch } from "./context.js";
import { fits } from "./fits.js";
import { withoutNothing } from "./nothing.js";

/**
 * The two ordinary answers to a value that may be nothing, as one line.
 *
 * One place, because two of them drift and this one is now reached from two
 * failures: a nullable handed where the plain type was asked for, and a member
 * read through the nullable without asking first.
 *
 * Neither answer is one sentence, because neither is true of every value. A
 * narrowing binds a NAME, so `if xs[0] != null` guards nothing and leaves the
 * reader the error they were given the line for; and `??` binds looser than
 * every arithmetic operator, so a stand-in dropped into `xs[0] + 1` reads as
 * `xs[0] ?? (0 + 1)` and answers something else. The head is what is true of
 * every nullable; each half is chosen for the value in hand.
 */
const IT_MAY_BE_NOTHING = "It may be nothing.";

/** The stand-in, where the value is the whole of what was asked for. */
const A_STAND_IN = "Give it a stand-in with `?? …`";

/** The stand-in, where an operator around the value would take it first. */
const A_BRACKETED_STAND_IN = "Bracket a stand-in around it, `(… ?? …)`";

/** The guard, where the value is a path a narrowing can follow. */
const ASK_FIRST = "ask `if x != null` first";

/** The guard, where it is not one, so there is nothing for the scope to bind. */
const NAME_IT_AND_ASK = "bind it to a name and ask `if … != null` first";

/**
 * Both halves in their plain form: a value that stands alone and is a name.
 *
 * Exported because the read through a nothing says it too, of the one receiver
 * shape it holds for, and the two must not drift.
 */
export const PAST_THE_NOTHING = `${IT_MAY_BE_NOTHING} ${A_STAND_IN}, or ${ASK_FIRST}.`;

/**
 * The way out, when what was found is what was wanted and nothing besides.
 *
 * `expected string, found string | null` is true and leaves the reader to work
 * out that the fault is the nothing, and that there are two ordinary answers to
 * it. This says which, and only where that is what happened: a `number` where a
 * `string` was wanted is a different mistake with different answers.
 *
 * @param mismatch The clash, whose node is the value the two types are about.
 * @returns The line to put under the mismatch, or nothing when the nothing is
 * not what went wrong.
 */
export function helpAboutNothing(mismatch: TypeMismatch): string | undefined {
  const rest = withoutNothing(mismatch.actual);
  if (!rest || !fits(rest, mismatch.expected)) return undefined;
  const standIn = takenFirst(mismatch.node) ? A_BRACKETED_STAND_IN : A_STAND_IN;
  const guard = narrowable(mismatch.node) ? ASK_FIRST : NAME_IT_AND_ASK;
  return `${IT_MAY_BE_NOTHING} ${standIn}, or ${guard}.`;
}

/**
 * Whether an operator would reach the value before a bare `??` did.
 *
 * The node itself as well as its container, because arithmetic reports on the
 * operand where it can and on the whole expression where the clash is the
 * combination, and a stand-in written into either needs the brackets.
 */
function takenFirst(node: AstNode): boolean {
  return anOperator(node) || anOperator(node.$container);
}

/** `+`, `-` and the rest, every one of which binds tighter than `??`. */
function anOperator(node: AstNode | undefined): boolean {
  return ast.isBinary(node) || ast.isUnary(node);
}

/** Whether a guard can follow the value: a name, or a path of names off one. */
function narrowable(node: AstNode): boolean {
  if (ast.isRef(node)) return true;
  return ast.isMember(node) && narrowable(node.receiver);
}
