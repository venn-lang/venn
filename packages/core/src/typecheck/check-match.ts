/**
 * `match`, checked: what each arm is handed, what the whole gives back, and
 * whether every case was written.
 *
 * This is the one construction that claims to enumerate, so it is the one asked
 * to cover what it is deciding on. `if` asks a question and is not.
 */

import { CODES } from "../codes/index.js";
import type { MatchArm, MatchExpr } from "../generated/ast.js";
import { type Asked, patternTests } from "../pattern/index.js";
import { checkBlock } from "./check-stmts.js";
import { expect, type Infer, inferExpr } from "./infer.js";
import { tagAt, written } from "./narrow.js";
import { patternTypes } from "./pattern-types.js";
import { mono } from "./scheme.js";
import { DYNAMIC, type Type, union } from "./type.types.js";
import { type TypeEnv, withAll } from "./type-env.js";
import { prune } from "./unify.js";

/** What one arm turned out to be, once the arms before it had their say. */
interface Arm {
  /** What it gives back, or `dynamic` when it runs steps instead. */
  readonly type: Type;
  /** The branches it takes for good, which the arms after it will not see. */
  readonly takes: readonly Type[];
  /** Whether anything still reaching this arm could match it. */
  readonly reachable: boolean;
}

/**
 * Check a `match` and answer with the type it gives back.
 *
 * @param args The expression, the scope it is written in, and whether a value is
 * wanted: an arm written as a block runs steps and has none to give.
 * @returns The type every arm agreed on, or `dynamic` where they did not.
 */
export function checkMatch(args: {
  expr: MatchExpr;
  env: TypeEnv;
  infer: Infer;
  wantsValue: boolean;
}): Type {
  const { expr, env, infer, wantsValue } = args;
  const subject = prune(inferExpr(expr.subject, env, infer));
  let left = branchesOf(subject);
  const arms = expr.arms.map((arm) => {
    const one = checkArm({ arm, left, infer, env, wantsValue });
    left = left.filter((branch) => !one.takes.includes(branch));
    return one;
  });
  report({ expr, left, arms, infer });
  return wantsValue ? agreed(arms, infer, expr) : DYNAMIC;
}

/** A union is its members; anything else is the one thing it is. */
function branchesOf(type: Type): readonly Type[] {
  return type.kind === "union" ? type.members : [type];
}

function checkArm(args: {
  arm: MatchArm;
  left: readonly Type[];
  infer: Infer;
  env: TypeEnv;
  wantsValue: boolean;
}): Arm {
  const { arm, left, infer, env } = args;
  const reaching = left.filter((branch) => reaches(branch, arm));
  const held = reaching.length > 0 ? union(reaching) : DYNAMIC;
  const bound = patternTypes({ pattern: arm.pattern, type: held, infer });
  const scope = withAll(
    env,
    bound.map(([name, type]) => [name, mono(type)] as const),
  );
  return {
    takes: left.filter((branch) => taken(branch, arm)),
    reachable: reaching.length > 0,
    type: bodyType({ arm, scope, infer, wantsValue: args.wantsValue }),
  };
}

/** Whether this branch of the subject could be the one the arm matches. */
function reaches(branch: Type, arm: MatchArm): boolean {
  return patternTests(arm.pattern).every((test) => {
    const tag = tagAt(branch, test.path);
    return tag === undefined || tag === test.value;
  });
}

/**
 * Whether this branch is settled by the arm, so no later one will see it.
 *
 * Only a branch filed under one value is: `200` takes the `200` of a union and
 * nothing at all of a plain `number`, since a number can still be anything else.
 * A pattern that asks nothing takes whatever is left, which is the catch-all.
 */
function taken(branch: Type, arm: MatchArm): boolean {
  return patternTests(arm.pattern).every((test) => tagAt(branch, test.path) === test.value);
}

function bodyType(args: {
  arm: MatchArm;
  scope: TypeEnv;
  infer: Infer;
  wantsValue: boolean;
}): Type {
  const { arm, scope, infer } = args;
  if (arm.value) return inferExpr(arm.value, scope, infer);
  if (!arm.body) return DYNAMIC;
  checkBlock(arm.body, scope, infer);
  if (args.wantsValue) noValue(arm, infer);
  return DYNAMIC;
}

/** Every arm has to agree, since the whole is one value with one type. */
function agreed(arms: readonly Arm[], infer: Infer, expr: MatchExpr): Type {
  const [first, ...rest] = arms;
  if (!first) return DYNAMIC;
  for (const arm of rest) expect(infer, expr, arm.type, first.type);
  return first.type;
}

function report(args: {
  expr: MatchExpr;
  left: readonly Type[];
  arms: readonly Arm[];
  infer: Infer;
}): void {
  const { expr, left, arms, infer } = args;
  expr.arms.forEach((arm, at) => {
    if (arms[at] && !arms[at].reachable) unreachable(arm, infer);
  });
  const missing = left.map((branch) => tagOfBranch(branch, expr));
  // All of them, or none: a branch nobody can name is a case nobody can be
  // asked to write, and a subject like `number` is every one of those.
  if (left.length > 0 && missing.every(known)) missingCases(expr, missing, infer);
}

function known(tag: Asked | undefined): tag is Asked {
  return tag !== undefined;
}

/** What a branch is filed under, read at the path the arms are asking about. */
function tagOfBranch(branch: Type, expr: MatchExpr): Asked | undefined {
  const first = expr.arms.flatMap((arm) => patternTests(arm.pattern))[0];
  return first && tagAt(branch, first.path);
}

function unreachable(arm: MatchArm, infer: Infer): void {
  infer.ctx.mismatches.push({
    node: arm.pattern,
    expected: DYNAMIC,
    actual: DYNAMIC,
    code: CODES.VN3020_UNREACHABLE_CASE,
    sentence: "Nothing that reaches this arm can match it, so it never runs.",
  });
}

function missingCases(expr: MatchExpr, missing: readonly Asked[], infer: Infer): void {
  infer.ctx.mismatches.push({
    node: expr.subject,
    expected: DYNAMIC,
    actual: DYNAMIC,
    code: CODES.VN3019_MISSING_CASE,
    sentence: `Nothing here says what to do when this is ${listed(missing)}.`,
  });
}

/** `"a"`, or `"a" or "b"`, or `"a", "b" or "c"`: a list a person would read out. */
function listed(missing: readonly Asked[]): string {
  const all = missing.map(written);
  const last = all[all.length - 1] as string;
  return all.length === 1 ? last : `${all.slice(0, -1).join(", ")} or ${last}`;
}

function noValue(arm: MatchArm, infer: Infer): void {
  infer.ctx.mismatches.push({
    node: arm,
    expected: DYNAMIC,
    actual: DYNAMIC,
    sentence: "An arm written as steps gives nothing back, and a value is wanted here.",
  });
}
