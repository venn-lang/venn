/**
 * `match`, checked: what each arm is handed, what the whole gives back, and
 * whether every case was written.
 *
 * This is the one construction that claims to enumerate, so it is the one asked
 * to cover what it is deciding on. `if` asks a question and is not.
 */

import { CODES } from "../codes/index.js";
import type { MatchArm, MatchExpr, Pattern } from "../generated/ast.js";
import { type Asked, type PatternTest, patternTests } from "../pattern/index.js";
import { checkBlock } from "./check-stmts.js";
import { expect, type Infer, inferExpr } from "./infer.js";
import { listed, tagAt } from "./narrow.js";
import { patternTypes } from "./pattern-types.js";
import { mono, type Scheme } from "./scheme.js";
import { showType } from "./show.js";
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
  const scope = withAll(env, boundBy({ arm, left, infer }));
  // Read in the arm's own scope, since asking about what the pattern named is
  // the whole reason to write one.
  if (arm.guard) inferExpr(arm.guard, scope, infer);
  return {
    takes: arm.guard ? [] : left.filter((branch) => taken(branch, arm)),
    reachable: reaching.length > 0,
    type: bodyType({ arm, scope, infer, wantsValue: args.wantsValue }),
  };
}

/**
 * What the arm binds, whichever way it was reached.
 *
 * Each way is read against the branches it alone can be, so `{ kind: "ping", at }`
 * asks Ping for `at` and nothing else does. A name bound by more than one way
 * holds either of them, and one bound by only some is refused: which of them
 * matched is not knowable here, so the body could not read it.
 */
function boundBy(args: { arm: MatchArm; left: readonly Type[]; infer: Infer }): [string, Scheme][] {
  const { arm, left, infer } = args;
  const ways = arm.patterns.map((pattern) => ({
    pattern,
    bound: patternTypes({ pattern, type: heldBy(pattern, left), infer }),
  }));
  const held = new Map<string, Type[]>();
  for (const way of ways) {
    for (const [name, type] of way.bound) held.set(name, [...(held.get(name) ?? []), type]);
  }
  for (const [name, types] of held) {
    if (types.length !== ways.length) partly(arm, name, infer);
  }
  return [...held].map(([name, types]) => [name, mono(merged(types))]);
}

/** Two ways that hand back the same type hand back one, not a union of twins. */
function merged(types: readonly Type[]): Type {
  const seen = new Map<string, Type>();
  for (const type of types) seen.set(showType(type), type);
  return union([...seen.values()]);
}

/** The branches one way in can be, which is what its own names are read from. */
function heldBy(pattern: Pattern, left: readonly Type[]): Type {
  const reaching = left.filter((branch) => couldBe(branch, pattern));
  return reaching.length > 0 ? union(reaching) : DYNAMIC;
}

/** Whether this branch of the subject could be the one the arm matches. */
function reaches(branch: Type, arm: MatchArm): boolean {
  return arm.patterns.some((pattern) => couldBe(branch, pattern));
}

/**
 * Whether the branch could be what this pattern matches.
 *
 * Only a literal rules a branch out here: a shape test asks about a value's
 * runtime form, which a tag says nothing about, so it settles neither way.
 */
function couldBe(branch: Type, pattern: Pattern): boolean {
  return patternTests(pattern).every((test) => {
    if (test.asks !== "is") return true;
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
 *
 * A guarded arm settles nothing at all, whatever its pattern says: the condition
 * may fail, and then the case is still nobody's. That is what keeps a match
 * whose only arm for a branch is guarded from passing for complete.
 *
 * A shape settles nothing either, and used to settle everything: an empty test
 * list is the catch-all, and a pattern made of names had one, so arm one took
 * every branch and every arm after it was reported unreachable. `{ user }` then
 * `{ order }` then a catch-all, which is how a payload is ordinarily dispatched,
 * did not compile.
 */
function taken(branch: Type, arm: MatchArm): boolean {
  return arm.patterns.some((pattern) => settles(branch, patternTests(pattern)));
}

/** A literal in the pattern, which is the only test that files a branch. */
type Literal = Extract<PatternTest, { asks: "is" }>;

const isLiteral = (test: PatternTest): test is Literal => test.asks === "is";

function settles(branch: Type, tests: readonly PatternTest[]): boolean {
  const literals = tests.filter(isLiteral);
  // Nothing to file it under: either the catch-all, which is no test at all, or
  // a shape, which says nothing about which branch of a union this is.
  if (literals.length === 0) return tests.length === 0;
  return literals.every((test) => tagAt(branch, test.path) === test.value);
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
  if (args.expr.arms.length === 0) noArms(args.expr, args.infer);
  else casesLeft(args);
}

/** What the arms did not settle between them, once there are arms at all. */
function casesLeft(args: {
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
  const asked = expr.arms.flatMap((arm) => arm.patterns.flatMap(patternTests));
  const first = asked.find((test) => test.asks === "is");
  return first && tagAt(branch, first.path);
}

/**
 * `match k { }`: no arm, so nothing to decide and nothing to give back.
 *
 * It answered `null` and satisfied a declared `-> string`, because the first arm
 * of none has no tag and arms that do not exist agree on anything.
 */
function noArms(expr: MatchExpr, infer: Infer): void {
  infer.ctx.mismatches.push({
    node: expr.subject,
    expected: DYNAMIC,
    actual: DYNAMIC,
    code: CODES.VN3019_MISSING_CASE,
    sentence: "This `match` has no arms, so there is nothing here it can decide.",
  });
}

function unreachable(arm: MatchArm, infer: Infer): void {
  infer.ctx.mismatches.push({
    node: arm.patterns[0] ?? arm,
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

/** A name only some of the ways in bind, which the body could not count on. */
function partly(arm: MatchArm, name: string, infer: Infer): void {
  infer.ctx.mismatches.push({
    node: arm.patterns[0] ?? arm,
    expected: DYNAMIC,
    actual: DYNAMIC,
    sentence: `Every way into this arm has to name "${name}", since which one matched is not knowable here.`,
  });
}

function noValue(arm: MatchArm, infer: Infer): void {
  infer.ctx.mismatches.push({
    node: arm,
    expected: DYNAMIC,
    actual: DYNAMIC,
    sentence: "An arm written as steps gives nothing back, and a value is wanted here.",
  });
}
