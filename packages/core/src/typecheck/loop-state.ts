/**
 * What a `loop` carries, and whether each `continue` still fits it.
 *
 * The two belong together: the state's shape is decided at the `loop` and every
 * `continue` in the body is a place it has to survive. A `continue` that
 * quietly drops half of it undermines the thing state was built for, because
 * the next pass reads the missing field as nothing and the program answers
 * wrongly rather than failing.
 */

import { CODES } from "../codes/index.js";
import type { ContinueStmt, Expr, LoopStmt } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { checkBlock } from "./check-stmts.js";
import { expect, type Infer, inferExpr } from "./infer.js";
import { mono } from "./scheme.js";
import { namedList } from "./show.js";
import { DYNAMIC, type Type } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { omittable, prune } from "./unify.js";

/**
 * `loop`, in all three shapes.
 *
 * The state is bound in the scope the loop stands in, not only inside it, so a
 * running total can be read after the loop the way the runtime leaves it. Its
 * type comes from the initial value, and the body is walked knowing it, which
 * is what gives every `continue` inside something to be checked against.
 *
 * @param node The loop, with a state, a condition, or neither.
 * @param env The scope it stands in.
 * @param infer Where mismatches are recorded.
 * @returns That scope plus the state, which outlives the loop.
 */
export function checkLoop(node: LoopStmt, env: TypeEnv, infer: Infer): TypeEnv {
  if (node.cond) inferExpr(node.cond, env, infer);
  if (!node.state) {
    checkBlock(node.body, env, { ...infer, carried: undefined });
    return env;
  }
  const state = inferExpr(node.state.initial, env, infer);
  const carried = env.with(node.state.name, mono(state));
  checkBlock(node.body, carried, { ...infer, carried: state });
  return carried;
}

/**
 * Check one `continue`, which nothing looked at before.
 *
 * @param node The statement, with or without a value.
 * @param env The scope it is written in: the loop's, plus whatever the body
 * bound above it.
 * @param infer Where the mismatch is recorded, carrying the loop's state type.
 * @returns That same scope: a `continue` binds nothing.
 */
export function checkContinue(node: ContinueStmt, env: TypeEnv, infer: Infer): TypeEnv {
  if (!node.value) return env;
  const value = inferExpr(node.value, env, infer);
  const to = carrier(node);
  const state = to === undefined || to === "pass" ? undefined : infer.carried;
  const lost = state ? dropped(value, state) : [];
  if (state && lost.length === 0) expect(infer, node.value, value, state);
  else notCarried({ at: node.value, said: said(lost, to === "pass"), infer });
  return env;
}

/**
 * What receives this `continue`: the loop whose state it becomes, a per-item
 * pass that keeps nothing between items, or nothing at all.
 *
 * The same walk the compiler makes to find the slot to write, in
 * `compile/nodes/body-steps.ts`. The two must agree, because one decides what
 * happens and the other decides what the reader is told about it. This one
 * tells `forEach` and `repeat` apart from the rest, which the compiler has no
 * reason to, because the way out of the mistake is different for them.
 */
function carrier(node: ContinueStmt): LoopStmt | "pass" | undefined {
  let up = node.$container as { $container?: unknown } | undefined;
  while (up) {
    if (ast.isFnExpr(up) || ast.isFnDecl(up)) return undefined;
    if (ast.isForEachStmt(up) || ast.isRepeatStmt(up)) return "pass";
    if (ast.isLoopStmt(up)) return up.state ? up : undefined;
    up = up.$container as { $container?: unknown } | undefined;
  }
  return undefined;
}

/**
 * Fields the state carries that the value does not.
 *
 * `fits` walks only the fields the value has, so a shorter record fits a longer
 * one and this drop is exactly what it cannot see. A field that may be nothing
 * may be left out, by the same rule that lets a record satisfy `nickname?:`.
 */
function dropped(value: Type, state: Type): string[] {
  const held = prune(value);
  const want = prune(state);
  if (held.kind !== "record" || want.kind !== "record") return [];
  if (held.open || want.open) return [];
  return [...want.fields]
    .filter(([name, type]) => !held.fields.has(name) && !omittable(type))
    .map(([name]) => name);
}

/**
 * The one refusal: a value that does not become the loop's state, because it
 * drops part of it or because nothing here is carrying anything at all.
 *
 * Both types are left unknown on purpose. The sentence says in words what went
 * wrong, so neither is ever rendered, and a reader told which field vanished
 * does not also need the two shapes.
 */
function notCarried(args: { at: Expr; said: readonly [string, string]; infer: Infer }): void {
  args.infer.ctx.mismatches.push({
    node: args.at,
    expected: DYNAMIC,
    actual: DYNAMIC,
    code: CODES.VN3027_STATE_NOT_CARRIED,
    sentence: args.said[0],
    help: args.said[1],
  });
}

/**
 * The sentence and the way out of it.
 *
 * Which way out matters: a `continue` inside a `repeat` may well sit inside a
 * `loop` that does have a state, so telling that reader to give the loop one
 * describes a program they already wrote. What is between the two is the thing
 * to name.
 */
function said(lost: readonly string[], pass: boolean): readonly [string, string] {
  if (lost.length > 0) return [drops(lost), SPREAD_THE_REST];
  return [NOWHERE, pass ? A_PASS_KEEPS_NOTHING : GIVE_THE_LOOP_A_STATE];
}

/** Named, because the two shapes printed side by side make the reader find it. */
function drops(lost: readonly string[]): string {
  return `This \`continue\` drops ${namedList(lost)} from the state the loop carries.`;
}

const NOWHERE = "Nothing carries this value to the next pass, so it is dropped.";
const SPREAD_THE_REST = "Spread the rest of it: `continue { ...s, … }`.";
const GIVE_THE_LOOP_A_STATE =
  "Only a `loop` with a state carries one: `loop n = 0 { … continue n + 1 }`.";
const A_PASS_KEEPS_NOTHING =
  "`repeat` and `forEach` start each pass with nothing. Write a bare `continue` here, or carry the value in the `loop`'s state.";
