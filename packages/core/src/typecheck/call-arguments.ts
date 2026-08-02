import type { AstNode } from "langium";
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
  const written = (args.expr.args?.args ?? []).map((arg) => arg.value);
  return eachFits({ written, given: args.given, wanted: callee.params, infer: args.infer });
}

/**
 * The same, given the parameters directly.
 *
 * A `run` has no callee to unify against: a fragment is a declaration, not a
 * value, so what it takes is read off its parameter list. What a caller hands it
 * is checked the same way and reported in the same place.
 *
 * @param args The argument expressions, their types, what the parameters are,
 * and where a mismatch is recorded.
 * @returns Whether every argument fits.
 */
export function eachFits(args: {
  written: readonly AstNode[];
  given: readonly Type[];
  wanted: readonly Type[];
  infer: Infer;
}): boolean {
  let ok = true;
  for (const [at, wanted] of args.wanted.entries()) {
    const held = args.given[at];
    const node = args.written[at];
    if (!held || !node || fits(held, wanted)) continue;
    args.infer.ctx.mismatches.push({ node, expected: wanted, actual: held });
    ok = false;
  }
  return ok;
}
