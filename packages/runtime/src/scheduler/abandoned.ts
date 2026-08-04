import { buildProblem, type Problem, type Span } from "@venn-lang/core";
import { GRACE_MS } from "../cancel/index.js";
import { RUN_CODES } from "../codes.js";
import type { Engine } from "./engine.types.js";

/**
 * Say that cancelled work did not stop, rather than reporting a verdict over it.
 *
 * Two things stay outside the language's reach: work that never gives the event
 * loop a turn, and an action that ignores the `ctx.signal` it was handed. A
 * scope that waited for either of them would be the hang cancellation exists to
 * prevent, so it waits a bounded while, leaves, and says here that something is
 * still running. That is the only honest reading of the envelopes that follow.
 *
 * @param args The engine, what was left running, and where it is written.
 */
export function reportAbandoned(args: { engine: Engine; title: string; where: Span }): void {
  args.engine.result.failed += 1;
  args.engine.emitter.emit({ kind: "expect.failed", data: { problem: problemOf(args) } });
}

function problemOf(args: { title: string; where: Span }): Problem {
  return {
    ...buildProblem({
      spec: { code: RUN_CODES.VN8002_STILL_RUNNING, severity: "error" },
      span: args.where,
      title: args.title,
    }),
    help: `It was given ${GRACE_MS}ms to stop and did not, so whatever it does from here happens after this run has been reported.`,
  };
}
