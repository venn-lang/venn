import type { Envelope } from "@venn-lang/core";
import type { EventSink } from "@venn-lang/runtime";

/**
 * One character per event worth a character, and a legend that does not lie: an
 * `F` used to stand for an assertion that failed and for a hook that blew up,
 * so a stream of dots said an expectation was made where none ever was.
 */
const MARKS: Partial<Record<Envelope["kind"], string>> = {
  "expect.passed": ".",
  "expect.failed": "F",
  "expect.soft_failed": "S",
  failure: "!",
};

/**
 * Terminal reporter: one char per assertion or failure, a summary at the end.
 *
 * @returns A sink that writes to stdout and keeps no state of its own.
 */
export function createDotSink(): EventSink {
  return { emit: (envelope) => write(envelope) };
}

function write(envelope: Envelope): void {
  const mark = MARKS[envelope.kind];
  if (mark) process.stdout.write(mark);
  else if (envelope.kind === "run.finished") writeSummary(envelope);
}

function writeSummary(envelope: Envelope): void {
  const data = envelope.data as { passed: number; failed: number; durationMs: number };
  process.stdout.write(`\n${data.passed} passed, ${data.failed} failed (${data.durationMs}ms)\n`);
}
