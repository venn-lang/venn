import { type Annotated, readFlaky } from "./annotations.js";
import type { Engine } from "./engine.types.js";
import type { FlakyTally } from "./flaky.types.js";
import { forget } from "./tally.js";

/**
 * Record one execution of a `@flaky(ratio)` node, and how much it failed by.
 *
 * @param engine The run this node belongs to.
 * @param node The annotated step or flow.
 * @param failed What THIS execution failed by, read off its own tally. Read as
 * a difference on the run's counter it also picked up every concurrent sibling,
 * so a `@flaky` step under a `parallel` was forgiven a neighbour's failure.
 */
export function recordFlaky(engine: Engine, node: Annotated, failed: number): void {
  const ratio = readFlaky(node);
  if (ratio === undefined) return;
  const tally = engine.flaky.get(node) ?? { ratio, runs: 0, failedRuns: 0, failedUnits: 0 };
  tally.runs += 1;
  tally.failedRuns += failed > 0 ? 1 : 0;
  tally.failedUnits += failed;
  engine.flaky.set(node, tally);
}

/**
 * Forgive the failures of every `@flaky` node whose observed failure ratio
 * stayed within its declared tolerance. Settled once, so the verdict does not
 * depend on the order iterations happened to fail in.
 */
export function settleFlaky(engine: Engine): void {
  for (const tally of engine.flaky.values()) {
    if (tally.failedRuns === 0 || tally.failedRuns / tally.runs > tally.ratio) continue;
    forget(engine, tally.failedUnits);
    engine.emitter.emit({ kind: "log", data: { level: "warn", message: message(tally) } });
  }
}

function message(tally: FlakyTally): string {
  return `flaky tolerated: ${tally.failedRuns}/${tally.runs} runs failed, within ratio ${tally.ratio}`;
}
