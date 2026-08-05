import type { AstNode } from "langium";
import { CODES } from "../codes/index.js";
import type { Call } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { fits } from "./fits.js";
// Type-only, so the cycle with `infer.ts` is erased at build.
import type { Infer } from "./infer.js";
import { DYNAMIC, type FnType, type Type } from "./type.types.js";
import { prune, sharedArity } from "./unify.js";

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
  if (!countFits(callee, written.length)) return tooManyOrFew(args.expr, callee, args.infer);
  const each = { written, given: args.given, wanted: callee.params, infer: args.infer };
  const counted = callbacksFit(each);
  return eachFits(each) && counted;
}

/** How many a call may hand over: all of them, or down to the first ignorable. */
function countFits(callee: FnType, given: number): boolean {
  const most = callee.params.length;
  if (given === most) return true;
  const least = callee.ignorableFrom;
  return least !== undefined && given >= least && given < most;
}

/**
 * The wrong number of arguments, counted.
 *
 * `unify` already knows: {@link sharedArity} answers `undefined` and the `false`
 * it becomes carries no counts, so the report fell through to the whole
 * signature and printed `expected fn(number) -> a, found fn(a, b) -> a`. Two
 * function types the reader did not write, in the order that reads backwards.
 */
function tooManyOrFew(expr: Call, callee: FnType, infer: Infer): false {
  const takes = callee.params.length;
  const least = callee.ignorableFrom;
  const range = least !== undefined && least < takes;
  const given = (expr.args?.args ?? []).length;
  infer.ctx.mismatches.push({
    node: expr,
    expected: callee,
    actual: DYNAMIC,
    code: CODES.VN3002_ARGUMENT_COUNT,
    sentence: `${calleeName(expr)} takes ${range ? `${least} to ${takes} arguments` : plural(takes)}, and got ${given}.`,
  });
  return false;
}

/** What the call names, for a sentence that can point at it by name. */
function calleeName(expr: Call): string {
  const callee = expr.callee;
  if (ast.isRef(callee)) return `\`${callee.name}\``;
  return ast.isMember(callee) ? `\`${callee.member}\`` : "This function";
}

/**
 * A function handed where one of another arity was asked for.
 *
 * `fits` lets differing counts through, on purpose: how many there are is
 * `unify`'s question. So a lambda of the wrong arity reaches the
 * whole-signature report and prints two nested function types. Counted here
 * instead, at the lambda, which is the thing the reader wrote.
 */
function callbacksFit(args: {
  written: readonly AstNode[];
  given: readonly Type[];
  wanted: readonly Type[];
  infer: Infer;
}): boolean {
  let ok = true;
  for (const [at, asked] of args.wanted.entries()) {
    const pair = handedOver(args.written[at], args.given[at], asked);
    if (!pair || sharedArity(pair.held, pair.asked) !== undefined) continue;
    countedCallback({ ...pair, infer: args.infer });
    ok = false;
  }
  return ok;
}

/** The two function types at one argument, when both are known and neither is open. */
function handedOver(
  node: AstNode | undefined,
  given: Type | undefined,
  asked: Type,
): { node: AstNode; held: FnType; asked: FnType } | undefined {
  if (!node || !given) return undefined;
  const held = prune(given);
  const wanted = prune(asked);
  if (held.kind !== "fn" || wanted.kind !== "fn") return undefined;
  if (held.variadic || wanted.variadic) return undefined;
  return { node, held, asked: wanted };
}

/** What it takes against what it will be handed, both as counts. */
function countedCallback(args: { node: AstNode; held: FnType; asked: FnType; infer: Infer }): void {
  args.infer.ctx.mismatches.push({
    node: args.node,
    expected: args.asked,
    actual: args.held,
    code: CODES.VN3002_ARGUMENT_COUNT,
    sentence: callbackCount(args.node, args.held, args.asked),
  });
}

/** Too many to be handed, or too few to be handed what the caller passes. */
function callbackCount(node: AstNode, held: FnType, asked: FnType): string {
  const takes = held.params.length;
  const least = asked.ignorableFrom ?? asked.params.length;
  const what = ast.isFnExpr(node) ? "This lambda" : "This function";
  if (takes < least) return `${what} takes ${plural(takes)}, and needs at least ${least}.`;
  return `${what} takes ${plural(takes)}, and is given ${asked.params.length}.`;
}

/** The same word the runtime's verb arity uses, so one fact reads one way. */
function plural(many: number): string {
  if (many === 0) return "no arguments";
  return many === 1 ? "1 argument" : `${many} arguments`;
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
