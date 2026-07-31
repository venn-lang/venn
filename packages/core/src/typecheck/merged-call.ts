/**
 * `a.merge(b)` and `a.mergeDeep(b)`, typed.
 *
 * What they give back depends on what they are handed, which a signature cannot
 * say: `fn(dynamic) -> dynamic` is all one can be written as. So the answer is
 * worked out at the call, from the same pouring `{ ...a, ...b }` does, and the
 * two spellings agree because there is one function behind both.
 */

import type { Call } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { Infer } from "./infer.js";
import { bothAsOne } from "./poured-into.js";
import type { Type } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * What the call gives back, when it is one of those two on a map the checker
 * knows.
 *
 * @param args The call, the types of its arguments, and where the receiver's
 * type was recorded while it was inferred.
 * @returns The merged shape, or nothing when this is some other call.
 */
export function mergedCall(args: {
  expr: Call;
  args: readonly Type[];
  infer: Infer;
}): Type | undefined {
  const callee = args.expr.callee;
  if (!ast.isMember(callee) || args.args.length !== 1) return undefined;
  const deep = callee.member === "mergeDeep";
  if (!deep && callee.member !== "merge") return undefined;
  const receiver = args.infer.types?.get(callee.receiver);
  const from = args.args[0];
  if (!receiver || !from || carries(receiver, callee.member)) return undefined;
  return bothAsOne(receiver, from, deep);
}

/** A map with a field of that name answers with the field, not with the verb. */
function carries(receiver: Type, name: string): boolean {
  const held = prune(receiver);
  return held.kind === "record" && held.fields.has(name);
}
