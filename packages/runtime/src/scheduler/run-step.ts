import { type Block, isBlock, isStepDecl, type StepDecl } from "@venn/core";
import type { Scope } from "../scope/index.js";
import { hasAnnotation, readLock } from "./annotations.js";
import type { Engine } from "./engine.types.js";
import { matchesTitle } from "./filter.js";
import { recordFlaky } from "./flaky.js";
import { runAround } from "./run-around.js";
import { runWithAnnotations, withLock } from "./run-attempts.js";
import { runBlock } from "./run-block.js";
import { isControlSignal } from "./signals.js";

/** Run a step honouring @skip/@only, @lock, @timeout and @retry; its bindings are step-local. */
export async function runStep(engine: Engine, step: StepDecl, parent: Scope): Promise<void> {
  if (!included(engine, step)) return;
  engine.emitter.emit({ kind: "step.started", data: { title: step.title } });
  const before = engine.result.failed;
  const scope = parent.child();
  try {
    await execute(engine, step, { parent, scope });
  } catch (error) {
    if (!isControlSignal(error)) finished(engine, step.title, "failed");
    throw error;
  }
  recordFlaky(engine, step, before);
  finished(engine, step.title, engine.result.failed > before ? "failed" : "passed");
}

/**
 * The gate `selectFlows` puts on a flow, put on a step: `@only` focuses, `@skip`
 * drops, and only then the `--step` title filter.
 *
 * A step is focused among the steps it stands with, meaning the block it was
 * written in, the way a flow is focused among the flows of its document.
 */
function included(engine: Engine, step: StepDecl): boolean {
  if (hasAnnotation(step, "skip")) return false;
  if (focusing(step.$container) && !hasAnnotation(step, "only")) return false;
  return matchesTitle(step.title, engine.filter.step);
}

/** Whether any step in this block asked to be the only one that runs. */
const focused = new WeakMap<Block, boolean>();

/**
 * Answered once per block: the source cannot change mid-run, and a step inside a
 * `forEach` would otherwise re-read its siblings on every pass.
 */
function focusing(container: unknown): boolean {
  if (!isBlock(container)) return false;
  const known = focused.get(container);
  if (known !== undefined) return known;
  const found = container.stmts.some((stmt) => isStepDecl(stmt) && hasAnnotation(stmt, "only"));
  focused.set(container, found);
  return found;
}

function execute(
  engine: Engine,
  step: StepDecl,
  scopes: { parent: Scope; scope: Scope },
): Promise<void> {
  return withLock(engine, readLock(step), () =>
    runWithAnnotations({
      engine,
      node: step,
      scope: scopes.parent,
      title: step.title,
      // The caller wants a promise; a block that never suspended returns none.
      run: () => runAround(step, () => runBlock(engine, step.body, scopes.scope)),
    }),
  );
}

function finished(engine: Engine, title: string, status: "passed" | "failed"): void {
  engine.emitter.emit({ kind: "step.finished", data: { title, status } });
}
