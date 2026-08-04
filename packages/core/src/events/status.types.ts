/**
 * Where a flow, step or action stands when an event reports it.
 *
 * `cancelled` is neither verdict: a `break`, `return` or `exit` cut the step
 * short, so it never reached one.
 */
export type Status = "passed" | "failed" | "skipped" | "running" | "cancelled";
