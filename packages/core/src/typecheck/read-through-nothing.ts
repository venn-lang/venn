/**
 * A member read through a value that may be nothing.
 *
 * `["a"][5]` is `null` at run time, and `["a"][5].len` is `null` as well, so a
 * program that reads a member off an out-of-range read gets a nothing where it
 * expected a number and finds out at the far end: `.toNumber` on it is `NaN`,
 * `take(NaN)` is the empty list, and a CLI called with a flag and no value
 * printed a plausible wrong report and exited 0.
 *
 * The rule that makes that loud is the same rule that makes the guard writable.
 * A read past the end is typed `T | null`, so `if raw == null` is a branch that
 * can run, and reading through it without asking is the mistake it always was.
 */

import { CODES } from "../codes/index.js";
import * as ast from "../generated/ast.js";
import { receiverAsWritten } from "./as-written.js";
import type { TypeMismatch } from "./context.js";
import type { MemberRead } from "./member-read.types.js";
import { withoutNothing } from "./nothing.js";
import { PAST_THE_NOTHING } from "./nothing-help.js";
import { NULL, type Type } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * What the receiver holds once the nothing is taken out, when reading through it
 * is a mistake this checker is sure of.
 *
 * Sure of, and not merely suspicious: what is left has to be something whose
 * members are known. `null | dynamic` is what a name seeded with nothing holds
 * before anything is written into it, and a plugin's result is `dynamic` too, so
 * demanding a guard there would refuse working files over a shape nobody here
 * can see. A `?.` is asking rather than telling, and gets its answer.
 *
 * @param receiver The pruned type being read.
 * @param read Which member, written how, and whether it asked.
 * @returns The rest of the type, to go on reading the member off, or nothing
 * when this read is not that mistake.
 */
export function throughNothing(receiver: Type, read: MemberRead): Type | undefined {
  return read.asking ? undefined : pastTheNothing(receiver);
}

/**
 * What is left once the nothing is out, when the checker is sure enough to say so.
 *
 * @param type The pruned type reached through.
 * @returns The rest of it, or nothing when this is not that mistake.
 */
function pastTheNothing(type: Type): Type | undefined {
  const rest = withoutNothing(type);
  if (!rest) return undefined;
  const settled = prune(rest);
  return settled.kind === "dynamic" || settled.kind === "var" ? undefined : rest;
}

/**
 * The report: what may be nothing, and which read cannot stand over it.
 *
 * Named as the source named it, because `string | null` is not a phrase the file
 * contains and `xs[5]` is.
 *
 * @param receiver The type that may be nothing.
 * @param read Which member, and where to say it.
 * @returns The mismatch to record, under VN3025.
 */
export function mayBeNothing(receiver: Type, read: MemberRead): TypeMismatch {
  const it = receiverAsWritten(read);
  return {
    node: read.node,
    expected: receiver,
    actual: NULL,
    code: CODES.VN3025_MAY_BE_NOTHING,
    sentence: `${it ?? "This value"} may be nothing here, so ${theRead(read)} cannot be read from it.`,
    help: wayPast(read, it),
  };
}

/**
 * The read as the reader will recognise it: a name in its quotes, a position in
 * its brackets, because those are the two things the file itself contains.
 */
function theRead(read: MemberRead): string {
  return read.spelled ? `\`${read.spelled}\`` : `"${read.name}"`;
}

/**
 * The way out, and it has to fit the line that earned it.
 *
 * A guard narrows a NAME. So where the receiver is one, the shared sentence is
 * right and is imported rather than restated. Where it is anything else, both
 * halves of that sentence are advice that does not work:
 *
 * - `if xs[5] != null { print xs[5].len }` reports VN3025 again, because there is
 *   no name for the narrowed scope to bind. Advice that leaves behind the error
 *   it was given for.
 * - `let n = xs[5] ?? "z".len` checks clean and means `xs[5] ?? ("z".len)`. The
 *   stand-in has to be bracketed around the receiver, and a reader told only
 *   ``?? …`` writes the version that compiles and answers something else.
 */
function wayPast(read: MemberRead, it: string | undefined): string {
  const node = read.node;
  const receiver = ast.isMember(node) || ast.isIndex(node) ? node.receiver : undefined;
  if (receiver && ast.isRef(receiver)) return PAST_THE_NOTHING;
  const named = it ?? "it";
  const tail = read.spelled ?? `.${read.name}`;
  return `It may be nothing. Bind it to a name and ask \`if … != null\` first, or bracket a stand-in around it: \`(${named} ?? …)${tail}\`.`;
}
