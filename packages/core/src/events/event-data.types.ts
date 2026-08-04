import type { Problem } from "../problem/index.js";
import type { RunPlan } from "./run-plan.types.js";
import type { Status } from "./status.types.js";

/**
 * The payload per event kind. EventKind is DERIVED from these keys, so adding an
 * event is a single edit here. This is the M1 subset of the §15 taxonomy.
 *
 * Three of these carry a `Problem`, and which one a failure travels on says what
 * kind of failure it was. `expect.failed` is an assertion the program made and
 * lost, `expect.soft_failed` is one it asked to record and walk past, and
 * `failure` is everything else: a hook, a branch, a verb, a timeout. A reporter
 * that counts assertions reads the first two; one that reports failures reads
 * all three. Nothing carries a failure as prose.
 */
export interface EventData {
  "run.started": { plan: RunPlan };
  "run.finished": { passed: number; failed: number; durationMs: number };
  "flow.started": { title: string };
  "flow.finished": { title: string; status: Status };
  "flow.retrying": { title: string; attempt: number; reason: string };
  "step.started": { title: string };
  "step.finished": { title: string; status: Status };
  "action.started": { namespace: string; action: string };
  "action.finished": { namespace: string; action: string; status: Status; durationMs: number };
  "expect.passed": { source: string };
  "expect.failed": { problem: Problem };
  "expect.soft_failed": { problem: Problem };
  failure: { problem: Problem };
  /**
   * What the program said, and nothing that went wrong: a failure has three
   * envelopes of its own and none of them is this one.
   */
  log: { level: "info" | "warn"; message: string };
}

/** Every event name, derived from {@link EventData}. */
export type EventKind = keyof EventData;
