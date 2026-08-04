import { type Block, isLifecycleDecl, type LifecycleDecl, type Statement } from "@venn-lang/core";
import { closeAll } from "../cleanup/index.js";
import type { Scope } from "../scope/index.js";
import { type BlockPlan, planOf, type Step } from "./block-plan.js";
import { branchEngine } from "./branch-engine.js";
import { checkpoint } from "./checkpoint.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { keepExit, runCleanup } from "./run-cleanup.js";
import { runStatement } from "./run-statements.js";

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
    checkpoint(engine);
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
    checkpoint(engine);
    const next = (steps[at] as Step)(engine, scope);
    if (next) await next;
  }
}

/**
 * The block, and the `defer` bodies it leaves behind, LIFO.
 *
 * Every one of them runs, however any of them ends. One that fails is reported
 * as VN7004 against its own line and the walk carries on, because the ones
 * behind it hold the resources this program is trying to hand back. Nothing here
 * touches the error already unwinding: it is what says why the block is ending.
 */
async function withDefers(engine: Engine, block: Block, scope: Scope): Promise<void> {
  const defers: LifecycleDecl[] = [];
  try {
    for (const stmt of block.stmts) {
      if (isDefer(stmt)) {
        defers.unshift(stmt);
        continue;
      }
      const pending = runStatement(engine, stmt, scope);
      if (pending) await pending;
    }
  } finally {
    // Detached: cleanup must complete even when what it tidies was cancelled
    // mid-flight, and it reaches the world through the same context an action
    // was handed, so the signal has to leave that too.
    const cleanup = branchEngine(engine, undefined);
    keepExit(await closeAll(defers.map((hook) => () => runCleanup(cleanup, hook, scope))));
  }
}

function isDefer(stmt: Statement): stmt is LifecycleDecl {
  return isLifecycleDecl(stmt) && stmt.hook === "defer";
}

export type { BlockPlan };
