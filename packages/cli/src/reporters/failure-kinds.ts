import type { Envelope, EventKind, Problem } from "@venn-lang/core";

/** The envelopes that carry a failure rather than describe one. */
type FailureKind = "expect.failed" | "expect.soft_failed" | "failure";

/**
 * The three envelopes a failure travels on, whatever raised it: an assertion the
 * program lost, one it asked to record and walk past, and everything else.
 *
 * One list, because a reporter that knows only some of them is a reporter that
 * goes quiet on the failures it never heard of.
 */
const FAILURE_KINDS: Partial<Record<EventKind, true>> = {
  "expect.failed": true,
  "expect.soft_failed": true,
  failure: true,
};

/**
 * The failure an envelope carries.
 *
 * @param envelope Any envelope off the stream.
 * @returns Its problem, or `undefined` when this envelope is not a failure.
 */
export function failureIn(envelope: Envelope): Problem | undefined {
  return carriesFailure(envelope) ? envelope.data.problem : undefined;
}

function carriesFailure(envelope: Envelope): envelope is Envelope<FailureKind> {
  return FAILURE_KINDS[envelope.kind] === true;
}
