import type { Call } from "../generated/ast.js";
import { fits } from "./fits.js";
// Type-only, so the cycle with `infer.ts` is erased at build.
import type { Infer } from "./infer.js";
import type { Type } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * Each argument against the parameter it was handed to.
 *
 * A call is checked by unifying the callee with a function built from the
 * arguments, which is the right way to solve the result and the wrong way to
 * report a failure: it reads `expected fn(string | null) -> string, found
 * fn(string) -> string`, two signatures the reader has to line up and invert.
 *
 * So the argument that does not fit is reported where it is written, against
 * the parameter that would not take it.
 *
 * @returns Whether every argument fits, so the caller can report the whole
 * signature when something other than an argument is wrong.
 */
export function argumentsFit(args: {
  expr: Call;
  callee: Type;
  given: readonly Type[];
  infer: Infer;
}): boolean {
  const callee = prune(args.callee);
  if (callee.kind !== "fn" || callee.variadic) return true;
  const written = args.expr.args?.args ?? [];
  let ok = true;
  for (const [at, wanted] of callee.params.entries()) {
    const held = args.given[at];
    const node = written[at]?.value;
    if (!held || !node || fits(held, wanted)) continue;
    args.infer.ctx.mismatches.push({ node, expected: wanted, actual: held });
    ok = false;
  }
  return ok;
}
