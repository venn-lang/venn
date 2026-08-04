import { type FlowDecl, isLifecycleDecl, type LifecycleDecl } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { hasAnnotation, readLock } from "./annotations.js";
import { beginFlow } from "./begin-flow.js";
import type { Engine } from "./engine.types.js";
import { recordFlaky } from "./flaky.js";
import { nodeSpan } from "./node-span.js";
import { release, reportFailure } from "./report-failure.js";
import { runAround } from "./run-around.js";
import { runWithAnnotations, withLock } from "./run-attempts.js";
import { runBlock } from "./run-block.js";
import { runOnHandlers } from "./run-lifecycle.js";
import { ExitSignal, isControlSignal } from "./signals.js";
import { scopeTally } from "./tally.js";
import type { Tally } from "./tally.types.js";

/**
 * Run a flow: body, then its `on failure`/`on success` handlers, then finish.
 *
 * An `exit` is the program leaving rather than a verdict, so on that path the
 * flow closes without its handlers. A reporter that never saw this flow end
 * reports a suite of nothing for a run that executed steps.
 *
 * The body runs on a tally of its own, so the verdict is this flow's failures.
 * The run's counter also carries what a `@flaky` node was forgiven and what a
 * `@retry` gave back, and neither of those is this flow's verdict.
 *
 * @param engine The run this flow belongs to.
 * @param flow The flow as written.
 * @param scope What its body reads from.
 * @raises The `exit` that ended the run, once this flow has been closed.
 */
export async function runFlow(engine: Engine, flow: FlowDecl, scope: Scope): Promise<void> {
  beginFlow(engine);
  engine.emitter.emit({ kind: "flow.started", data: { title: flow.title } });
  const { engine: scoped, tally } = scopeTally(engine);
  try {
    await runFlowBody(scoped, flow, scope);
  } catch (error) {
    const status = tally.count > 0 ? "failed" : "cancelled";
    engine.emitter.emit({ kind: "flow.finished", data: { title: flow.title, status } });
    throw error;
  }
  await settleFlow({ engine: scoped, flow, scope, tally });
}

/** The verdict, the handlers it chooses, and the finish that carries it. */
async function settleFlow(args: {
  engine: Engine;
  flow: FlowDecl;
  scope: Scope;
  tally: Tally;
}): Promise<void> {
  recordFlaky(args.engine, args.flow, args.tally.count);
  const status = args.tally.count > 0 ? "failed" : "passed";
  const handlers = args.flow.body.stmts.filter(isOnHandler);
  const event = status === "failed" ? "failure" : "success";
  await runOnHandlers({ engine: args.engine, handlers, event, scope: args.scope });
  const title = args.flow.title;
  args.engine.emitter.emit({ kind: "flow.finished", data: { title, status } });
}

async function runFlowBody(engine: Engine, flow: FlowDecl, scope: Scope): Promise<void> {
  try {
    await withLock(engine, flowLock(flow), () =>
      runWithAnnotations({
        engine,
        node: flow,
        scope,
        title: flow.title,
        // The body takes the engine rather than closing over it: a `@timeout`
        // makes a scope for the body, and one closed over here would never see it.
        // The caller wants a promise; a block that never suspended returns none.
        run: (scoped) => runAround(flow, () => runBlock(scoped, flow.body, scope)),
      }),
    );
  } catch (error) {
    // `break`/`return` end the flow and no more than that. `exit` is not the
    // flow's to absorb: it ends the run, so it keeps unwinding.
    if (error instanceof ExitSignal) throw error;
    // Whoever raises a failure reports it where it happened, so this is the
    // last resort rather than the usual path: a throw from a frame that had no
    // step to name, or one from below the language that cannot be named at all.
    // One already reported is not reported again.
    if (!isControlSignal(error)) {
      reportFailure({ engine, error, span: nodeSpan(flow, engine.uri) });
    }
    // The propagation stops here, so a later throw of the same object is a
    // failure of its own: one memoised rejected promise hands every awaiter the
    // same `Error`, and three flows that awaited it are three failures.
    release(error);
  }
}

/** `@lock("x")` uses a named mutex; `@serial` serialises runs of the same flow. */
function flowLock(flow: FlowDecl): string | undefined {
  return readLock(flow) ?? (hasAnnotation(flow, "serial") ? `serial:${flow.title}` : undefined);
}

function isOnHandler(stmt: unknown): stmt is LifecycleDecl {
  return isLifecycleDecl(stmt) && Boolean((stmt as LifecycleDecl).event);
}
