import type { EventKind } from "@venn-lang/core";

/**
 * The envelope kinds a failure may travel on, all of which carry a `Problem`.
 *
 * Which one it is says what kind of failure it was, which is the distinction
 * every reporter needs and none of them could make while a hook blowup and a
 * lost assertion arrived on the same envelope.
 */
export type FailureKind = Extract<EventKind, "expect.failed" | "expect.soft_failed" | "failure">;
