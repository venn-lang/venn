import { type FlowDecl, isLifecycleDecl, type LifecycleDecl, ProblemError } from "@venn/core";
import type { Scope } from "../scope/index.js";
import { hasAnnotation, readLock } from "./annotations.js";
import type { Engine } from "./engine.types.js";
import { recordFlaky } from "./flaky.js";
import { runAround } from "./run-around.js";
import { runWithAnnotations, withLock } from "./run-attempts.js";
import { runBlock } from "./run-block.js";
import { runOnHandlers } from "./run-lifecycle.js";
import { ExitSignal, isControlSignal } from "./signals.js";

/** Run a flow: body, then its `on failure`/`on success` handlers, then finish. */
export async function runFlow(engine: Engine, flow: FlowDecl, scope: Scope): Promise<void> {
  engine.emitter.emit({ kind: "flow.started", data: { title: flow.title } });
  const before = engine.result.failed;
  const handlers = flow.body.stmts.filter(isOnHandler);
  await runFlowBody(engine, flow, scope);
  recordFlaky(engine, flow, before);
  const status = engine.result.failed > before ? "failed" : "passed";
  const event = status === "failed" ? "failure" : "success";
  await runOnHandlers({ engine, handlers, event, scope });
  engine.emitter.emit({ kind: "flow.finished", data: { title: flow.title, status } });
}

async function runFlowBody(engine: Engine, flow: FlowDecl, scope: Scope): Promise<void> {
  try {
    await withLock(engine, flowLock(flow), () =>
      runWithAnnotations({
        engine,
        node: flow,
        scope,
        title: flow.title,
        // The caller wants a promise; a block that never suspended returns none.
        run: () => runAround(flow, () => runBlock(engine, flow.body, scope)),
      }),
    );
  } catch (error) {
    // `break`/`return` end the flow and no more than that. `exit` is not the
    // flow's to absorb: it ends the run, so it keeps unwinding.
    if (error instanceof ExitSignal) throw error;
    if (!isControlSignal(error)) recordError(engine, error);
  }
}

/** `@lock("x")` uses a named mutex; `@serial` serialises runs of the same flow. */
function flowLock(flow: FlowDecl): string | undefined {
  return readLock(flow) ?? (hasAnnotation(flow, "serial") ? `serial:${flow.title}` : undefined);
}

function isOnHandler(stmt: unknown): stmt is LifecycleDecl {
  return isLifecycleDecl(stmt) && Boolean((stmt as LifecycleDecl).event);
}

/**
 * A failure the flow itself could not handle.
 *
 * One that already knows what it is (a Problem, with its code, its span and its
 * help) travels on the event every reporter reads for failures. Flattening it to
 * a log line would strip the code and the location the raiser worked out.
 */
function recordError(engine: Engine, error: unknown): void {
  engine.result.failed += 1;
  if (error instanceof ProblemError) {
    engine.emitter.emit({ kind: "expect.failed", data: { problem: error.problem } });
    return;
  }
  const message = (error as { message?: string })?.message ?? String(error);
  engine.emitter.emit({ kind: "log", data: { level: "error", message } });
}
