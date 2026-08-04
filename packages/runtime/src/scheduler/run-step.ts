import { type Block, interpolateText, isBlock, isStepDecl, type StepDecl } from "@venn-lang/core";
import { stepEmitter } from "../emit/index.js";
import type { Scope } from "../scope/index.js";
import { hasAnnotation, readLock } from "./annotations.js";
import { AssertionFailed } from "./assertion-failed.js";
import type { Engine } from "./engine.types.js";
import { matchesTitle } from "./filter.js";
import { recordFlaky } from "./flaky.js";
import { nodeSpan } from "./node-span.js";
import { release, reportFailure } from "./report-failure.js";
import { runAround } from "./run-around.js";
import { runWithAnnotations, withLock } from "./run-attempts.js";
import { runBlock } from "./run-block.js";
import { isControlSignal } from "./signals.js";
import { scopeTally } from "./tally.js";
import type { Tally } from "./tally.types.js";

/**
 * Run a step honouring @skip/@only, @lock, @timeout and @retry; its bindings are
 * step-local.
 *
 * The body runs on the step's own view of the engine: its identity stamped on
 * everything the body emits, so a failure keeps the name of the step it happened
 * in even when two steps under a `parallel` are open at once, and a tally of its
 * own, so the verdict is this step's failures rather than the run's. Read off
 * the shared counter, a step that passed reported failed because a sibling
 * under the same `parallel` had failed while it was still running.
 *
 * @param engine The frame this step was reached through.
 * @param step The step as written.
 * @param parent The scope it was reached in.
 * @raises Whatever its body raised, after reporting it and closing the step.
 */
export async function runStep(engine: Engine, step: StepDecl, parent: Scope): Promise<void> {
  const title = await interpolateText({ text: step.title, env: parent });
  if (!included(engine, step, title)) return;
  const emitter = stepEmitter(engine.emitter, engine.emitter.nextStep());
  const { engine: scoped, tally } = scopeTally({ ...engine, emitter });
  emitter.emit({ kind: "step.started", data: { title } });
  await body({ engine: scoped, step, parent, title, tally });
  recordFlaky(engine, step, tally.count);
  const status = tally.count > 0 ? "failed" : "passed";
  emitter.emit({ kind: "step.finished", data: { title, status } });
}

/** One run of a step: its own engine, and what it is answerable for. */
interface Running {
  engine: Engine;
  step: StepDecl;
  parent: Scope;
  title: string;
  tally: Tally;
}

/**
 * The body, and the failure that stops here.
 *
 * This is the innermost frame that catches, so it is the one that reports: an
 * assertion as the checks it lost, anything else as the failure it is. Reported
 * at the flow boundary instead, it would arrive after the step had closed, under
 * no name at all.
 */
async function body(args: Running): Promise<void> {
  const scopes = { parent: args.parent, scope: args.parent.child(), title: args.title };
  try {
    await execute(args.engine, args.step, scopes);
  } catch (error) {
    if (!isControlSignal(error)) {
      reportFailure({ engine: args.engine, error, span: nodeSpan(args.step, args.engine.uri) });
    }
    // An assertion ends the step it was written in and no more than that, so
    // the step closes above the way one that ran to its end does, and the claim
    // goes back because the propagation stopped right here.
    if (error instanceof AssertionFailed) return release(error);
    cutShort({ ...args, error });
  }
}

/**
 * A step that did not run to its end, closed and left unwinding.
 *
 * A `break` or a `return` is not a verdict, so a step cut short by one is
 * neither passed nor failed unless something had already gone wrong in it.
 *
 * @param args The run of the step, and what it raised.
 * @raises What it was given, which is on its way somewhere this step is not.
 */
function cutShort(args: Running & { error: unknown }): never {
  const status = args.tally.count > 0 ? "failed" : "cancelled";
  args.engine.emitter.emit({ kind: "step.finished", data: { title: args.title, status } });
  throw args.error;
}

/**
 * The gate `selectFlows` puts on a flow, put on a step: `@only` focuses, `@skip`
 * drops, and only then the `--step` title filter.
 *
 * A step is focused among the steps it stands with, meaning the block it was
 * written in, the way a flow is focused among the flows of its document.
 */
function included(engine: Engine, step: StepDecl, title: string): boolean {
  if (hasAnnotation(step, "skip")) return false;
  if (focusing(step.$container) && !hasAnnotation(step, "only")) return false;
  return matchesTitle(title, engine.filter.step);
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
  scopes: { parent: Scope; scope: Scope; title: string },
): Promise<void> {
  return withLock(engine, readLock(step), () =>
    runWithAnnotations({
      engine,
      node: step,
      scope: scopes.parent,
      title: scopes.title,
      // The body takes the engine rather than closing over it: a `@timeout`
      // makes a scope for the body, and one closed over here would never see it.
      // The caller wants a promise; a block that never suspended returns none.
      run: (scoped) => runAround(step, () => runBlock(scoped, step.body, scopes.scope)),
    }),
  );
}
