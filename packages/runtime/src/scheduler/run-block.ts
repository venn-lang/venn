import { type Block, isLifecycleDecl, type LifecycleDecl, type Statement } from "@venn/core";
import type { Scope } from "../scope/index.js";
import { type BlockPlan, planOf, type Step } from "./block-plan.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { runStatement } from "./run-statements.js";
import { CancelSignal } from "./signals.js";

/**
 * Run a block's statements in order, running any `defer { … }` bodies LIFO on
 * the way out, including on error or a control-flow signal.
 */
export function runBlock(engine: Engine, block: Block, scope: Scope): Pending {
  const plan = planOf(block);
  if (plan.defers) return withDefers(engine, block, scope);
  return runSteps(engine, plan.steps, scope);
}

/** The walk over a plan, reusable by a loop that hoists `planOf` out of it. */
export function runSteps(engine: Engine, steps: readonly Step[], scope: Scope): Pending {
  for (let at = 0; at < steps.length; at += 1) {
    if (engine.signal?.aborted) throw new CancelSignal();
    const pending = (steps[at] as Step)(engine, scope);
    if (pending) return resume(engine, steps, at + 1, scope, pending);
  }
  return undefined;
}

async function resume(
  engine: Engine,
  steps: readonly Step[],
  from: number,
  scope: Scope,
  pending: Promise<void>,
): Promise<void> {
  await pending;
  for (let at = from; at < steps.length; at += 1) {
    if (engine.signal?.aborted) throw new CancelSignal();
    const next = (steps[at] as Step)(engine, scope);
    if (next) await next;
  }
}

async function withDefers(engine: Engine, block: Block, scope: Scope): Promise<void> {
  const defers: Block[] = [];
  try {
    for (const stmt of block.stmts) {
      if (isDefer(stmt)) {
        defers.unshift(stmt.body);
        continue;
      }
      const pending = runStatement(engine, stmt, scope);
      if (pending) await pending;
    }
  } finally {
    const cleanup: Engine = { ...engine, signal: undefined };
    for (const body of defers) await runBlock(cleanup, body, scope.child());
  }
}

function isDefer(stmt: Statement): stmt is LifecycleDecl {
  return isLifecycleDecl(stmt) && stmt.hook === "defer";
}

export type { BlockPlan };
