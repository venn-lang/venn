import type { Cell } from "../../expr/cell.types.js";
import { hasCells } from "../../expr/cell.types.js";
import { makeClosure } from "../../expr/closure.js";
import type { Closure } from "../../expr/closure.types.js";
import type { EvalEnv } from "../../expr/eval-env.types.js";
import { INLINE_SLOTS } from "../../expr/frame.js";
import {
  type Expr,
  type FnBody,
  type FnDecl,
  type FnExpr,
  isLetStmt,
  type LetStmt,
  type ParamList,
} from "../../generated/ast.js";
import type { CompiledBody, CompiledLocal, Thunk } from "../compile.types.js";
import { type LexScope, scopeOf, stayedBare } from "../lex-scope.js";
import { paramLocals, paramSlotName, unpack, wholeValueName } from "../unpack.js";
import { compileStep } from "./body-steps.js";

/** How the dispatcher compiles a sub-expression in a given scope. */
export type CompileIn = (expr: Expr, scope: LexScope) => Thunk;

/** `fn (…) => …` as a value: the body is compiled here, not on every evaluation. */
export function compileFnExpr(expr: FnExpr, compileIn: CompileIn): Thunk {
  const params = paramNames(expr.params);
  // No `cellOf`: this body is compiled once and shared by every closure the
  // expression makes, so it cannot hold cells belonging to one of them.
  const body = compileBody({ params: expr.params, body: expr.body, compileIn });
  return (env) => makeClosure(params, body, env);
}

/**
 * A top-level `fn name(…)`, bound into a scope.
 *
 * This body is compiled per closure, and there is exactly one closure per
 * declaration, so the cells its free names resolve to can be captured in the
 * thunks that read them. That is what lets a recursive function keep its own
 * name without needing an environment to find it in, which in turn is what lets
 * it run without a frame.
 */
export function closureIn(decl: FnDecl, env: EvalEnv, compileIn: CompileIn): Closure {
  const cellOf = hasCells(env) ? (name: string) => env.cell(name) : undefined;
  const body = compileBody({ params: decl.params, body: decl.body, compileIn, cellOf });
  return makeClosure(paramNames(decl.params), body, env);
}

interface BodyArgs {
  params: ParamList | undefined;
  body: FnBody;
  compileIn: CompileIn;
  /** Absent when the body is shared by more than one closure. */
  cellOf?: (name: string) => Cell;
}

/**
 * Compile a body, first assuming it needs no frame.
 *
 * Whether it does is known only once it has been compiled: a free name needs
 * cells to reach, and a `"${…}"` asks for names as text. So the optimistic pass
 * runs and is thrown away when it was wrong, which costs one extra compile of
 * one body against an allocation saved on every call it will ever receive.
 */
function compileBody(args: BodyArgs): CompiledBody {
  const first = compileInScope(scoped(args), args);
  if (first.bare || !first.wasBare) return first.compiled;
  const plain = scoped(args);
  plain.bare = false;
  return compileInScope(plain, args).compiled;
}

function scoped(args: BodyArgs): LexScope {
  const scope = scopeOf(args.params, args.body);
  scope.cellOf = args.cellOf;
  return scope;
}

function compileInScope(
  scope: LexScope,
  args: BodyArgs,
): { compiled: CompiledBody; bare: boolean; wasBare: boolean } {
  const { body, compileIn } = args;
  const wasBare = Boolean(scope.bare);
  const params = args.params?.params ?? [];
  // The leading run of bindings keeps the path it had: filled before the body
  // runs, in one loop. Everything after the first real statement is a step.
  const leading = body.stmts.filter((_, at) => at < firstStatement(body));
  const rest = body.stmts.slice(firstStatement(body));
  const locals = [
    ...paramLocals(params, scope),
    ...leading.flatMap((local, at) => localsOf({ local: local as LetStmt, at, scope, compileIn })),
  ];
  const steps = rest.map((stmt) => compileStep(stmt, scope, compileIn));
  const result = body.result ? compileIn(body.result, scope) : undefined;
  const bare = stayedBare(scope);
  const extra = Math.max(0, scope.names.length - INLINE_SLOTS);
  const free = scope.free ?? [];
  const compiled = { names: scope.names, extra, free, locals, result, bare };
  return {
    compiled: steps.length === 0 ? compiled : { ...compiled, steps, bare: false },
    bare,
    wasBare,
  };
}

function paramNames(params: ParamList | undefined): readonly string[] {
  return (params?.params ?? []).map(paramSlotName);
}

/**
 * Where the bindings stop and the statements start.
 *
 * A body written before a body could hold a statement is bindings and a value,
 * and every one of those keeps the path it had: filled up front, in one loop,
 * with no step between.
 */
function firstStatement(body: FnBody): number {
  const at = body.stmts.findIndex((stmt) => !isLetStmt(stmt));
  return at === -1 ? body.stmts.length : at;
}

/**
 * One `let` of the body, compiled. A pattern is several: the value lands in the
 * slot holding it whole, and each name it binds reads its way out of that.
 */
function localsOf(args: {
  local: LetStmt;
  at: number;
  scope: LexScope;
  compileIn: CompileIn;
}): CompiledLocal[] {
  const { local, at, scope, compileIn } = args;
  const value = compileIn(local.value, scope);
  if (!local.pattern) return [{ slot: scope.names.indexOf(local.name as string), value }];
  const whole = scope.names.indexOf(wholeValueName("let", at));
  return [{ slot: whole, value }, ...unpack(local.pattern, scope, whole)];
}
