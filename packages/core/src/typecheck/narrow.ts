/**
 * Narrowing a union by the field that tells its branches apart.
 *
 * `if r.kind == "ok"` is the only thing standing between a value that might be
 * two shapes and code that reads one of them. Inside that block `r` is the `ok`
 * branch and nothing else, and in the `else` it is everything that was left.
 */

import { CODES } from "../codes/index.js";
import type { Expr } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { scanInterpolations } from "../interpolation/index.js";
import type { Infer } from "./infer.js";
import { instantiate, mono } from "./scheme.js";
import { type Type, union } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { fieldType, prune } from "./unify.js";

/** What a value has to be for a branch to run. */
export type Tag = string | number | boolean;

/** What a condition says about a name: the `r.kind == "ok"` of it. */
export interface Discriminant {
  /** The name being tested. Narrowing rebinds this one. */
  name: string;
  /** The field read on it, absent when the name itself is compared. */
  field?: string;
  value: Tag;
  /** `!=` swaps which side of the branch learns something. */
  equals: boolean;
}

/** The scopes the two sides of a condition are checked in. */
export interface Branches {
  whenTrue: TypeEnv;
  whenFalse: TypeEnv;
}

/**
 * The scopes a condition's two sides run in.
 *
 * @param cond The condition, which may say nothing about anything.
 * @param env The scope the condition itself was read in.
 * @param infer Where a case that cannot happen is reported.
 * @returns The narrowed scopes, or `env` twice when there was nothing to learn.
 */
export function narrowed(cond: Expr, env: TypeEnv, infer: Infer): Branches {
  if (isAnd(cond)) return bothSides(cond, env, infer);
  const both = { whenTrue: env, whenFalse: env };
  const found = discriminantOf(cond);
  const type = found && subject(found.name, env, infer);
  if (!found || !type) return both;
  const members = branchesOf(type);
  // Every branch has to be filed under a value it alone carries. Anything else
  // is an ordinary comparison, where `s == "a"` says nothing about what `s` is.
  if (members.some((member) => tagOf(member, found.field) === undefined)) return both;
  return split({ found, members, env, infer, cond });
}

/** A union is its members; anything else is the one thing it is. */
function branchesOf(type: Type): readonly Type[] {
  return type.kind === "union" ? type.members : [type];
}

/** `a && b` narrows by both, since both held for the block to run. */
function bothSides(cond: ast.Binary, env: TypeEnv, infer: Infer): Branches {
  const left = narrowed(cond.left, env, infer);
  const right = narrowed(cond.right, left.whenTrue, infer);
  // Its `else` says only that one of the two failed, which is not one shape.
  return { whenTrue: right.whenTrue, whenFalse: env };
}

function isAnd(cond: Expr): cond is ast.Binary {
  return ast.isBinary(cond) && cond.operator === "&&";
}

function split(args: {
  found: Discriminant;
  members: readonly Type[];
  env: TypeEnv;
  infer: Infer;
  cond: Expr;
}): Branches {
  const { found, members, env, infer, cond } = args;
  const matching = members.filter((member) => tagOf(member, found.field) === found.value);
  const rest = members.filter((member) => !matching.includes(member));
  const [yes, no] = found.equals ? [matching, rest] : [rest, matching];
  if (yes.length === 0) {
    impossible(cond, found, infer);
    return { whenTrue: env, whenFalse: env };
  }
  if (no.length === 0) return { whenTrue: env, whenFalse: env };
  return { whenTrue: bind(env, found.name, yes), whenFalse: bind(env, found.name, no) };
}

function bind(env: TypeEnv, name: string, members: readonly Type[]): TypeEnv {
  return env.with(name, mono(union(members)));
}

/**
 * A branch that can never run: the union has no member left that the condition
 * would let through, either because nothing ever carried that value or because
 * an earlier branch already took it.
 */
function impossible(cond: Expr, found: Discriminant, infer: Infer): void {
  const subject = found.field ? `${found.name}.${found.field}` : found.name;
  infer.ctx.mismatches.push({
    node: cond,
    expected: { kind: "dynamic" },
    actual: { kind: "dynamic" },
    code: CODES.VN3020_UNREACHABLE_CASE,
    sentence: `${subject} is never ${written(found.value)} here, so this never runs.`,
  });
}

/** A value as it was written, so the message names what the source names. */
export function written(value: Tag): string {
  return typeof value === "string" ? `"${value}"` : String(value);
}

/** What a member of the union has to be for this branch: its tag, or nothing. */
export function tagOf(member: Type, field: string | undefined): Tag | undefined {
  const held = field ? fieldOf(member, field) : member;
  const t = held && prune(held);
  return t?.kind === "literal" ? t.value : undefined;
}

function fieldOf(member: Type, field: string): Type | undefined {
  const t = prune(member);
  return t.kind === "record" ? fieldType(t, field) : undefined;
}

/** The type a name holds right here, which is what a narrowed scope changes. */
function subject(name: string, env: TypeEnv, infer: Infer): Type | undefined {
  const scheme = env.lookup(name);
  return scheme && prune(instantiate(scheme, infer.ctx));
}

/**
 * The name, field and value a condition tests, when it tests one at all.
 *
 * Only `==` and `!=` against something written out, since those are the ones
 * that leave no doubt about what the value is on either side.
 */
export function discriminantOf(cond: Expr): Discriminant | undefined {
  if (!ast.isBinary(cond) || (cond.operator !== "==" && cond.operator !== "!=")) return undefined;
  const equals = cond.operator === "==";
  const left = tested(cond.left);
  const right = tested(cond.right);
  const leftValue = literalOf(cond.left);
  const value = literalOf(cond.right);
  if (left && value !== undefined) return { ...left, value, equals };
  if (right && leftValue !== undefined) return { ...right, value: leftValue, equals };
  return undefined;
}

/** The side that names something: `r` or `r.kind`, and nothing deeper. */
function tested(expr: Expr): { name: string; field?: string } | undefined {
  if (ast.isRef(expr)) return { name: expr.name };
  if (ast.isMember(expr) && ast.isRef(expr.receiver) && !expr.optional) {
    return { name: expr.receiver.name, field: expr.member };
  }
  return undefined;
}

/**
 * The side that is a value: a string, written out.
 *
 * Only a string, because only a string can be written as a type: `"ok" | "err"`
 * is a union anyone can declare and `1 | 2` is not, so a tag is always text. A
 * `${…}` inside it makes the string a value the run works out, which is no tag
 * at all.
 */
function literalOf(expr: Expr): Tag | undefined {
  if (!ast.isStringLit(expr)) return undefined;
  return scanInterpolations(expr.value).length > 0 ? undefined : expr.value;
}
