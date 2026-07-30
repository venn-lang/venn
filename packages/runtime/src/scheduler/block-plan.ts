import {
  type Block,
  compileExpr,
  isLetStmt,
  isLifecycleDecl,
  type LetStmt,
  type Statement,
} from "@venn-lang/core";
import { type Binder, binderFor, type Scope } from "../scope/index.js";
import type { Engine } from "./engine.types.js";
import { actionCall } from "./invocation.js";
import type { Pending } from "./pending.types.js";
import { runStatement } from "./run-statements.js";
import { isPending } from "./settled.js";

/** One statement of a block, bound to everything the source already settled. */
export type Step = (engine: Engine, scope: Scope) => Pending;

/** A block reduced to what running it needs, decided once from the source. */
export interface BlockPlan {
  readonly steps: readonly Step[];
  readonly defers: boolean;
}

const plans = new WeakMap<Block, BlockPlan>();

/** The plan for a block, built on first use and cached against the node itself. */
export function planOf(block: Block): BlockPlan {
  const known = plans.get(block);
  if (known) return known;
  const built: BlockPlan = {
    steps: block.stmts.map(stepOf),
    defers: block.stmts.some(isDefer),
  };
  plans.set(block, built);
  return built;
}

function isDefer(stmt: Statement): boolean {
  return isLifecycleDecl(stmt) && stmt.hook === "defer";
}

function stepOf(stmt: Statement): Step {
  return plainLet(stmt) ?? ((engine, scope) => runStatement(engine, stmt, scope));
}

/**
 * `const y = x * 2`: no trailing args, no options map, and a value that is not a
 * dotted path, so no registry lookup can turn it into a verb. The name, the
 * compiled expression and the decision are all fixed by the source.
 */
function plainLet(stmt: Statement): Step | undefined {
  if (!isLetStmt(stmt)) return undefined;
  const let_ = stmt as LetStmt;
  if (let_.args.length > 0 || let_.opts) return undefined;
  const call = actionCall(let_.value);
  if (call && call.target.indexOf(".") >= 0) return undefined;
  const bind_ = binderFor(let_);
  const thunk = compileExpr(let_.value);
  return (_engine, scope) => bind(bind_, thunk(scope), scope);
}

function bind(binder: Binder, value: unknown, scope: Scope): Pending {
  if (isPending(value)) return value.then((settled) => binder(settled, scope));
  return void binder(value, scope);
}
