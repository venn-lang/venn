import type { Problem } from "../problem/index.js";
import type { RunPlan } from "./run-plan.types.js";
import type { Status } from "./status.types.js";

/**
 * The payload per event kind. EventKind is DERIVED from these keys, so adding an
 * event is a single edit here. This is the M1 subset of the §15 taxonomy.
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
  log: { level: string; message: string };
}

/** Every event name, derived from {@link EventData}. */
export type EventKind = keyof EventData;
