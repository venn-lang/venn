import { buildProblem, CODES } from "../../codes/index.js";
import { ProblemError, UNLOCATED } from "../../problem/index.js";
import type { TargetKind } from "./handle.types.js";

/**
 * The verb this kind does not have, answered with the ones it does.
 *
 * Never `undefined`, never a `TypeError`: a decorator that reaches for
 * `.addParam` on a flow has made a mistake the language can name, and naming it
 * beside the whole surface of that kind is the shortest path to the fix.
 */
export function missingVerb(args: {
  verb: string;
  kind: TargetKind;
  offered: Iterable<string>;
}): ProblemError {
  const has = [...args.offered].join(", ");
  return verbRefusal(`A ${args.kind} has no \`${args.verb}\`. It has ${has}.`);
}

/** A verb this target cannot honour, for a reason of its own. */
export function verbRefusal(title: string): ProblemError {
  return new ProblemError(buildProblem({ spec: CODES.VN2017_DECO_VERB, span: UNLOCATED, title }));
}
