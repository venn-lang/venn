import { buildProblem, type Call, CODES, isRef, type Problem } from "@venn/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * Refuse a fragment called as though it were a function.
 *
 * The two look alike where they are written but are different kinds of thing: a
 * `fn` gives back a value, a `fragment` gives back steps, and steps are recorded
 * in the report, can fail and belong to a flow. So a fragment is invoked with
 * `run`. `run entrar(…)` never reaches here: its target is a name, not an
 * expression.
 *
 * @param call The call expression to inspect.
 * @param ctx The document's resolved check context.
 * @returns A `VN3013` problem, or `undefined` when the callee is not a fragment.
 */
export function checkFragmentCall(call: Call, ctx: CheckContext): Problem | undefined {
  const callee = call.callee;
  if (!isRef(callee) || !ctx.fragments.has(callee.name)) return undefined;
  return buildProblem({
    spec: CODES.VN3013_NOT_CALLABLE,
    span: nodeSpan(call, ctx.uri),
    title: `${callee.name} is a fragment, so it cannot be called for a value.`,
    note: `Invoke it with \`run ${callee.name}(…)\`, which records its steps in the report.`,
  });
}
