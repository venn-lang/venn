import type { Cell } from "../../expr/cell.types.js";
import { hasCells } from "../../expr/cell.types.js";
import { closureWith, makeClosure } from "../../expr/closure.js";
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
import { boundValue } from "../box.js";
import { capturePlan } from "../capture.js";
import type { CompiledBody, CompiledLocal, Step, Thunk } from "../compile.types.js";
import { allocate, declare, type LexScope, scopeOf, stayedBare } from "../lex-scope.js";
import { boxedParams, paramLocals, paramSlotName, unpack } from "../unpack.js";
import { compileStep } from "./body-steps.js";
import { refuseACall } from "./pure-body.js";

/** How the dispatcher compiles a sub-expression in a given scope. */
export type CompileIn = (expr: Expr, scope: LexScope) => Thunk;

/**
 * `fn (…) => …` as a value: the body is compiled here, not on every evaluation.
 *
 * Where its free names live is settled here too, against the block the `fn` is
 * written in, so making the closure reads a list rather than the source.
 */
export function compileFnExpr(expr: FnExpr, scope: LexScope, compileIn: CompileIn): Thunk {
  const params = paramNames(expr.params);
  // No `cellOf`: this body is compiled once and shared by every closure the
  // expression makes, so it cannot hold cells belonging to one of them.
  const body = compileBody({ params: expr.params, body: expr.body, compileIn });
  const plan = capturePlan(body.free, scope);
  if (!plan) return (env) => makeClosure(params, body, env);
  return (env) => closureWith({ params, body, env, up: plan.map((one) => one(env)) });
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
 * Compile a body, first assuming it needs no frame and that nothing captures
 * its bindings.
 *
 * Both are known only once it has been compiled: a free name needs cells to
 * reach, and which slots a closure written inside captured is the closure's
 * answer, not the source's. So the optimistic pass runs and is thrown away when
 * it was wrong, which costs one extra compile of one body against an allocation
 * saved on every call, and on every pass of every loop that captures nothing.
 */
function compileBody(args: BodyArgs): CompiledBody {
  const first = compileInScope(scoped(args), args);
  if (first.bare || !(first.wasBare || first.nested)) return first.compiled;
  const again = scoped(args);
  again.bare = false;
  again.boxes = first.captures;
  again.binds = new Set(first.compiled.names);
  return compileInScope(again, args).compiled;
}

function scoped(args: BodyArgs): LexScope {
  const scope = scopeOf(args.params, args.body);
  scope.cellOf = args.cellOf;
  return scope;
}

/** Every slot the body ended up with, which is only known once it is compiled. */
function extraSlots(scope: LexScope): number {
  return Math.max(0, scope.names.length - INLINE_SLOTS);
}

/** One pass over a body, and what the pass after it needs to know. */
interface Pass {
  compiled: CompiledBody;
  bare: boolean;
  wasBare: boolean;
  /** A `fn` is written in the body, so what it captured is only now known. */
  nested: boolean;
  captures: ReadonlySet<number>;
}

function compileInScope(scope: LexScope, args: BodyArgs): Pass {
  const { body, compileIn } = args;
  const wasBare = Boolean(scope.bare);
  const params = args.params?.params ?? [];
  // The leading run of bindings keeps the path it had: filled before the body
  // runs, in one loop. Everything after the first real statement is a step.
  const leading = body.stmts.filter((_, at) => at < firstStatement(body));
  const rest = body.stmts.slice(firstStatement(body));
  const locals = [
    ...paramLocals(params, scope),
    ...boxedParams(params, scope),
    ...leading.flatMap((local) => localsOf({ local: local as LetStmt, scope, compileIn })),
  ];
  const steps = rest.map((stmt) => compileStep(stmt, scope, compileIn));
  const result = body.result ? compileIn(body.result, scope) : undefined;
  const compiled = bodyOf({ scope, locals, steps, result });
  return { compiled, bare: compiled.bare, wasBare, ...found(scope) };
}

/** What the pass learned, kept apart from what it compiled. */
function found(scope: LexScope): { nested: boolean; captures: ReadonlySet<number> } {
  return { nested: Boolean(scope.nested), captures: scope.captures ?? new Set() };
}

function bodyOf(args: {
  scope: LexScope;
  locals: CompiledLocal[];
  steps: readonly Step[];
  result: Thunk | undefined;
}): CompiledBody {
  const { scope, locals, steps, result } = args;
  const boxed = scope.boxes?.size ? scope.boxes : undefined;
  const shared = { names: scope.names, extra: extraSlots(scope), free: scope.free ?? [], boxed };
  if (steps.length === 0) return { ...shared, locals, result, bare: stayedBare(scope) };
  return { ...shared, locals, result, bare: false, steps };
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
  scope: LexScope;
  compileIn: CompileIn;
}): CompiledLocal[] {
  const { local, scope, compileIn } = args;
  refuseACall(local);
  const value = compileIn(local.value, scope);
  if (!local.pattern) {
    const slot = declare(scope, local.name as string);
    return [{ slot, value: boundValue(value, scope, slot) }];
  }
  const whole = allocate(scope);
  return [{ slot: whole, value }, ...unpack(local.pattern, scope, whole)];
}
