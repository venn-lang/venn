/**
 * What a lambda's parameters are, worked out before its body is walked.
 *
 * A lambda is written inside the call that will hand it its arguments, so the
 * call already knows what they hold: `xs.map(x => …)` is a `list<number>`'s
 * `map`, and `x` is a number. Leaving the parameter open and unifying it
 * afterwards walks the body against a variable, and a variable answers
 * `dynamic` to every member read. That is what made the same mistake fatal on
 * one line and silent inside a lambda two lines away:
 * `xs.map(x => x.nope)` passed while `xs[0].nope` was VN3010, and
 * `counts.entries.sortBy(e => -e.value)` sorted a report by `NaN` in silence.
 *
 * Nothing is invented here. Where the call says nothing about a position, or
 * says only a variable it has not solved yet, the parameter stays open exactly
 * as it was: a body walked against a guess refuses working programs, and this
 * runs over every file in the repository.
 */

import type { Param } from "../generated/ast.js";
import type { Infer } from "./infer.js";
import type { Type } from "./type.types.js";
import { typeRefToType } from "./type-ref.js";
import { prune } from "./unify.js";

/**
 * Each parameter with the type its body will see it as.
 *
 * @param args The parameter nodes in the order they were written, the inference
 * state, and what the place the lambda sits in asks the whole function to be.
 * @returns One entry per node, in the same order, for the caller to put in
 * scope and to record for hover.
 */
export function lambdaParams(args: {
  nodes: readonly Param[];
  infer: Infer;
  wanted: Type | undefined;
}): { node: Param; type: Type }[] {
  const asked = askedParams(args.wanted);
  return args.nodes.map((node, at) => ({
    node,
    type: paramType(node, args.infer, asked[at]),
  }));
}

/**
 * The parameter types the place a lambda sits in names, in order.
 *
 * Only a function shape names any. A parameter asking for a list of functions
 * is asking for a value, not describing one being written here.
 */
function askedParams(wanted: Type | undefined): readonly Type[] {
  if (!wanted) return [];
  const asked = prune(wanted);
  return asked.kind === "fn" ? asked.params : [];
}

/**
 * What one parameter is: what it was annotated with, what the call site asks of
 * it, what the callers of a named `fn` said, or an open question for the body.
 *
 * The annotation wins over the call site, so `xs.map(fn (p: string) => …)` over
 * a list of numbers stays the mismatch it always was, reported once where the
 * whole signature is compared rather than again at every use of `p`.
 */
function paramType(param: Param, infer: Infer, asked: Type | undefined): Type {
  if (param.paramType) {
    const { ctx, named, catalog } = infer;
    return typeRefToType({ ref: param.paramType, ctx, named, catalog });
  }
  return asked ?? infer.seeds?.get(param) ?? infer.ctx.fresh();
}
