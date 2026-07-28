import { type Annotated, readFlaky } from "./annotations.js";
import type { Engine } from "./engine.types.js";
import type { FlakyTally } from "./flaky.types.js";

/** Record one execution of a `@flaky(ratio)` node, and how much it failed by. */
export function recordFlaky(engine: Engine, node: Annotated, before: number): void {
  const ratio = readFlaky(node);
  if (ratio === undefined) return;
  const tally = engine.flaky.get(node) ?? { ratio, runs: 0, failedRuns: 0, failedUnits: 0 };
  const delta = engine.result.failed - before;
  tally.runs += 1;
  tally.failedRuns += delta > 0 ? 1 : 0;
  tally.failedUnits += delta > 0 ? delta : 0;
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
    engine.result.failed = Math.max(0, engine.result.failed - tally.failedUnits);
    engine.emitter.emit({ kind: "log", data: { level: "warn", message: message(tally) } });
  }
}

function message(tally: FlakyTally): string {
  return `flaky tolerated: ${tally.failedRuns}/${tally.runs} runs failed, within ratio ${tally.ratio}`;
}
