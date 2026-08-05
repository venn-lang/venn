import { type Block, isLifecycleDecl, type LifecycleDecl, type Statement } from "@venn-lang/core";
import { closeAll } from "../cleanup/index.js";
import type { Scope } from "../scope/index.js";
import { type BlockPlan, planOf, type Step } from "./block-plan.js";
import { cleanupEngine } from "./branch-engine.js";
import { checkpoint } from "./checkpoint.js";
import { isNamedHook, type LifecycleHooks } from "./collect.js";
import type { Engine } from "./engine.types.js";
import type { Pending } from "./pending.types.js";
import { release } from "./report-failure.js";
import type { Branching } from "./run-block.types.js";
import { keepExit, runCleanup } from "./run-cleanup.js";
import { runHooks } from "./run-lifecycle.js";
import { runStatement } from "./run-statements.js";

/** A block being run with the lifetime it wrote around its statements. */
interface Closing {
  engine: Engine;
  block: Block;
  hooks: LifecycleHooks | undefined;
  scope: Scope;
}

/** The walk over a block's statements, and where the `defer`s it reaches go. */
interface Walking {
  engine: Engine;
  block: Block;
  defers: LifecycleDecl[];
  scope: Scope;
}

/** A block's lifetime being handed back: its `teardown`, then the `defer`s it reached. */
interface Giving {
  engine: Engine;
  hooks: LifecycleHooks | undefined;
  defers: readonly LifecycleDecl[];
  scope: Scope;
}

/**
 * Run a block's statements in order, with whatever it wrote around them: its
 * `setup` first, its `teardown` last, and any `defer { … }` bodies LIFO on the
 * way out, including on error or a control-flow signal.
 */
export function runBlock(engine: Engine, block: Block, scope: Scope): Pending {
  const plan = planOf(block);
  if (plan.hooks || plan.defers) return closing({ engine, block, hooks: plan.hooks, scope });
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
 * A block whose statements are branches rather than a sequence, run with the
 * lifetime it wrote around them.
 *
 * A concurrent block dispatches its own statements, so what belongs to the
 * block has to be lifted out here too: a `setup` left among them would race the
 * branches it was written to run before, and in a `race` it would win. A
 * `defer` is the block's as well, and runs once all the branches have settled.
 *
 * @param args.block The block as written, hooks and all.
 * @param args.run What to do with the branches, on the engine they run under.
 * @raises Whatever the branches raised, once the block has been given back.
 */
export async function runBranches(args: Branching): Promise<void> {
  const { engine, scope } = args;
  const plan = planOf(args.block);
  if (!plan.hooks && !plan.defers) return args.run({ engine, stmts: args.block.stmts });
  const hooks = plan.hooks;
  const defers = args.block.stmts.filter(isDefer).reverse();
  const stmts = args.block.stmts.filter((stmt) => !isNamedHook(stmt) && !isDefer(stmt));
  try {
    if (hooks) await runHooks({ engine, hooks: hooks.setup, scope });
    await args.run({ engine: aroundEachStep(engine, hooks), stmts });
  } finally {
    await giveBack({ engine, hooks, defers, scope });
  }
}

/**
 * A block with a lifetime of its own.
 *
 * `setup` runs inside the `try`, because an `exit` in it ends the run where it
 * stands and what that `setup` opened is still open: a file's pair reads that
 * way one level up, and the four words mean the same thing wherever they are
 * written.
 */
async function closing(args: Closing): Promise<void> {
  const { engine, hooks, scope } = args;
  const defers: LifecycleDecl[] = [];
  try {
    if (hooks) await runHooks({ engine, hooks: hooks.setup, scope });
    await walk({ engine: aroundEachStep(engine, hooks), block: args.block, defers, scope });
  } finally {
    await giveBack({ engine, hooks, defers, scope });
  }
}

/**
 * What the block opened, given back in the order a file already has one level
 * down, and for the same reason: `teardown` first, because it still needs what
 * the `defer`s are about to close, then the `defer`s in reverse.
 *
 * On a detached engine, since this is exactly the moment the block's own scope
 * may have been called off.
 */
async function giveBack(args: Giving): Promise<void> {
  const engine = cleanupEngine(args.engine);
  if (args.hooks) await runHooks({ engine, hooks: args.hooks.teardown, scope: args.scope });
  await runDefers({ engine, defers: args.defers, scope: args.scope });
}

/** The statements, with each `defer` set aside as it is reached rather than run. */
async function walk(args: Walking): Promise<void> {
  for (const stmt of args.block.stmts) {
    if (isDefer(stmt)) {
      args.defers.unshift(stmt);
      continue;
    }
    if (isNamedHook(stmt)) continue;
    const pending = runStatement(args.engine, stmt, args.scope);
    if (pending) await pending;
  }
}

/**
 * Every `defer` the block reached, LIFO.
 *
 * Every one of them runs, however any of them ended. One that fails is reported
 * as VN7004 against its own line and the walk carries on, because the ones
 * behind it hold the resources this program is trying to hand back. Nothing here
 * touches the error already unwinding: it is what says why the block is ending.
 */
async function runDefers(args: {
  engine: Engine;
  defers: readonly LifecycleDecl[];
  scope: Scope;
}): Promise<void> {
  if (args.defers.length === 0) return;
  const work = args.defers.map((hook) => () => runCleanup(args.engine, hook, args.scope));
  // Reported and then dropped here, so a later throw of the same object is a
  // failure of its own rather than a repeat of this one.
  for (const one of keepExit(await closeAll(work))) release(one);
}

/**
 * The engine the statements run on, carrying what wraps each step underneath.
 *
 * Stacked rather than replaced, outermost first: a `beforeEach` in a flow and
 * another in a group inside it both mean each step of what they were written
 * in, and the group's steps are inside both.
 */
function aroundEachStep(engine: Engine, hooks: LifecycleHooks | undefined): Engine {
  if (!hooks || hooks.beforeEach.length + hooks.afterEach.length === 0) return engine;
  const outer = engine.each;
  return {
    ...engine,
    each: {
      before: [...(outer?.before ?? []), ...hooks.beforeEach],
      after: [...hooks.afterEach, ...(outer?.after ?? [])],
    },
  };
}

function isDefer(stmt: Statement): stmt is LifecycleDecl {
  return isLifecycleDecl(stmt) && stmt.hook === "defer";
}

export type { BlockPlan };
