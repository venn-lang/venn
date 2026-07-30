import { callArgs } from "../ast/index.js";
import type { Block, Expr, FragmentDecl, Statement } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { callType } from "./action-signature.js";
import { expect, type Infer, inferExpr } from "./infer.js";
import { mono } from "./scheme.js";
import { DYNAMIC, type Type } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { typeRefToType } from "./type-ref.js";
import { prune } from "./unify.js";

/** Walk a statement, inferring the expressions it contains under `env`. */
export function checkStatement(node: Statement, env: TypeEnv, infer: Infer): TypeEnv {
  if (ast.isLetStmt(node)) return bindLet(node, env, infer);
  if (ast.isExpectStmt(node)) return expectStmt(node, env, infer);
  if (ast.isActionCall(node)) return actionArgs(node, env, infer);
  if (ast.isRunStmt(node)) return runArgs(node, env, infer);
  if (ast.isIfStmt(node)) return ifStmt(node, env, infer);
  if (ast.isForEachStmt(node)) return forEach(node, env, infer);
  if (ast.isLoopStmt(node)) return checkLoop(node, env, infer);
  if (ast.isRepeatStmt(node)) return repeat(node, env, infer);
  if (ast.isTryStmt(node)) return tryStmt(node, env, infer);
  if (ast.isReturnStmt(node)) return maybeInfer(node.value, env, infer);
  if (ast.isStepDecl(node) || ast.isGroupDecl(node)) return nested(node.body, env, infer);
  if (ast.isParallelStmt(node) || ast.isRaceStmt(node)) return nested(node.body, env, infer);
  if (ast.isLifecycleDecl(node)) return nested(node.body, env, infer);
  return env;
}

/** Check a nested block, then keep the outer scope: its bindings do not escape. */
function nested(block: Block, env: TypeEnv, infer: Infer): TypeEnv {
  checkBlock(block, env, infer);
  return env;
}

/** A `let`/`const` binds its inferred type; the binding is visible from here on. */
function bindLet(node: ast.LetStmt, env: TypeEnv, infer: Infer): TypeEnv {
  const type = isCall(node) ? boundCall(node, env, infer) : inferExpr(node.value, env, infer);
  const declared = declaredTypeOf(node, infer);
  // An annotation the checker parses and never reads is worse than no
  // annotation: the author believes something is being enforced.
  if (declared) expect(infer, node.value, type, declared);
  // Record it on the declaration too, so a hover on the name knows the type.
  infer.types?.set(node, declared ?? type);
  return env.with(node.name, mono(declared ?? type));
}

function declaredTypeOf(node: ast.LetStmt, infer: Infer): Type | undefined {
  if (!node.declaredType) return undefined;
  const { ctx, named, catalog } = infer;
  return typeRefToType({ ref: node.declaredType, ctx, named, catalog });
}

/** Trailing arguments or an options map are what make a binding a verb call. */
function isCall(node: ast.LetStmt): boolean {
  return node.args.length > 0 || node.opts !== undefined;
}

function boundCall(node: ast.LetStmt, env: TypeEnv, infer: Infer): Type {
  return callType({ target: targetOf(node.value), args: node.args, opts: node.opts }, env, infer);
}

/** The dotted name a call was written with, such as `http.serve`. */
function targetOf(value: Expr): string {
  return (value as { $cstNode?: { text?: string } }).$cstNode?.text?.trim() ?? "";
}

function expectStmt(node: ast.ExpectStmt, env: TypeEnv, infer: Infer): TypeEnv {
  if (node.subject) inferExpr(node.subject, env, infer);
  for (const check of node.checks) inferExpr(check, env, infer);
  return env;
}

/**
 * A verb written as a statement, in either spelling.
 *
 * `callArgs` because the arguments live in different places on the node: bare
 * ones hang off the statement, bracketed ones sit in the call. Reading only the
 * first makes `http.on(api, route)` look like a call with no arguments, and then
 * nothing tells `route` what it is handed.
 */
function actionArgs(node: ast.ActionCall, env: TypeEnv, infer: Infer): TypeEnv {
  callType({ target: node.target, args: callArgs(node), opts: node.opts }, env, infer);
  return env;
}

function runArgs(node: ast.RunStmt, env: TypeEnv, infer: Infer): TypeEnv {
  for (const arg of node.args?.args ?? []) inferExpr(arg.value, env, infer);
  return node.bind ? env.with(node.bind, mono(DYNAMIC)) : env;
}

function ifStmt(node: ast.IfStmt, env: TypeEnv, infer: Infer): TypeEnv {
  inferExpr(node.cond, env, infer);
  checkBlockOrIf(node.then, env, infer);
  if (node.otherwise) checkBlockOrIf(node.otherwise, env, infer);
  return env;
}

function checkBlockOrIf(node: Block | ast.IfStmt, env: TypeEnv, infer: Infer): void {
  if (ast.isIfStmt(node)) ifStmt(node, env, infer);
  else checkBlock(node, env, infer);
}

/** `forEach item in source`: the item's type is the source's element type. */
function forEach(node: ast.ForEachStmt, env: TypeEnv, infer: Infer): TypeEnv {
  const source = prune(inferExpr(node.source, env, infer));
  const item: Type = source.kind === "list" ? source.element : DYNAMIC;
  checkBlock(node.body, env.with(node.item, mono(item)), infer);
  return env;
}

function repeat(node: ast.RepeatStmt, env: TypeEnv, infer: Infer): TypeEnv {
  inferExpr(node.count, env, infer);
  const inner = node.index ? env.with(node.index, mono({ kind: "prim", name: "number" })) : env;
  checkBlock(node.body, inner, infer);
  return env;
}

function tryStmt(node: ast.TryStmt, env: TypeEnv, infer: Infer): TypeEnv {
  checkBlock(node.body, env, infer);
  if (node.handler) {
    const scope = node.error ? env.with(node.error, mono(DYNAMIC)) : env;
    checkBlock(node.handler, scope, infer);
  }
  if (node.finalizer) checkBlock(node.finalizer, env, infer);
  return env;
}

/**
 * `loop`, in all three shapes.
 *
 * The state is bound in the scope the loop stands in, not only inside it, so a
 * running total can be read after the loop the way the runtime leaves it. Its
 * type comes from the initial value; a `continue` of another type is a mismatch
 * the ordinary check reports where it is written.
 */
function checkLoop(node: ast.LoopStmt, env: TypeEnv, infer: Infer): TypeEnv {
  if (node.cond) inferExpr(node.cond, env, infer);
  if (!node.state) {
    checkBlock(node.body, env, infer);
    return env;
  }
  const carried = env.with(node.state.name, mono(inferExpr(node.state.initial, env, infer)));
  checkBlock(node.body, carried, infer);
  return carried;
}

function maybeInfer(expr: Expr | undefined, env: TypeEnv, infer: Infer): TypeEnv {
  if (expr) inferExpr(expr, env, infer);
  return env;
}

/** A block opens its own scope; bindings inside it do not escape. */
export function checkBlock(block: Block, env: TypeEnv, infer: Infer): void {
  let scope = env;
  for (const stmt of block.stmts) scope = checkStatement(stmt, scope, infer);
}

/** A fragment's params are in scope throughout its body. */
export function checkFragment(decl: FragmentDecl, env: TypeEnv, infer: Infer): void {
  let scope = env;
  for (const param of decl.params?.params ?? []) scope = scope.with(param.name, mono(DYNAMIC));
  checkBlock(decl.body, scope, infer);
}
