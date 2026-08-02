import type { FnType, RecordType, Type } from "./type.types.js";
import { prune, unify } from "./unify.js";

/**
 * Whether every value `actual` describes is one `expected` allows.
 *
 * `unify` asks whether two types can be *made* equal, which is the right
 * question for inference and the wrong one for assignment: a `string | null`
 * can be made equal to a `string` by picking the member that fits, and the
 * member it leaves behind is exactly the null nobody handled.
 *
 * So this asks the directional question, and only the part `unify` gets wrong.
 * Where neither side is a union and neither holds one, `unify` has already
 * decided and this defers to it.
 *
 * Anything unknown, a variable or `dynamic`, fits. A checker that guesses about
 * what it cannot see is worse than one that stays quiet.
 */
export function fits(actual: Type, expected: Type): boolean {
  const from = prune(actual);
  const into = prune(expected);
  if (from.kind === "dynamic" || into.kind === "dynamic") return true;
  if (from.kind === "var" || into.kind === "var") return true;
  if (from.kind === "union") return from.members.every((member) => fits(member, into));
  if (into.kind === "union") return into.members.some((member) => fits(from, member));
  return through(from, into);
}

/**
 * The same question one level in.
 *
 * A `list<string | null>` is not a `list<string>` for the same reason its
 * element is not a `string`, and a record's field is a place a value is asked
 * for like any other.
 *
 * Two types that hold nothing are handed to `unify`, which is where the one
 * answer to "is this that" lives. It binds nothing here: a variable never
 * reaches this far.
 */
function through(from: Type, into: Type): boolean {
  if (from.kind === "list" && into.kind === "list") return fits(from.element, into.element);
  if (from.kind === "record" && into.kind === "record") return fieldsFit(from, into);
  if (from.kind === "fn" && into.kind === "fn") return signatureFits(from, into);
  return unify(from, into);
}

/**
 * A function where another was asked for.
 *
 * Its result is where its values come out, so it is asked the same question
 * anything else is. Its parameters are where values go *in*, so the question
 * turns around: what may be handed to the one that was asked for has to be
 * something the one being handed over can take. That is how a call is checked,
 * since a call asks whether the callee fits a function built from the arguments
 * at the call site.
 *
 * A variadic takes what it is given, and only the shared parameters are
 * compared, which is the same latitude `unify` allows.
 */
function signatureFits(from: FnType, into: FnType): boolean {
  if (!fits(from.result, into.result)) return false;
  if (from.variadic || into.variadic) return true;
  // How many there are is `unify`'s question, and it answers before this is
  // reached: what is left here is what each one holds.
  if (from.params.length !== into.params.length) return true;
  for (const [at, taken] of from.params.entries()) {
    const given = into.params[at];
    if (given && !fits(given, taken)) return false;
  }
  return true;
}

function fieldsFit(from: RecordType, into: RecordType): boolean {
  for (const [name, wanted] of into.fields) {
    const held = from.fields.get(name);
    if (held && !fits(held, wanted)) return false;
  }
  return true;
}
