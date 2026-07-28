import type { Envelope } from "@venn-lang/core";
import type { EventSink } from "@venn-lang/runtime";

/** Terminal reporter: one char per assertion, a summary line at the end. */
export function createDotSink(): EventSink {
  return { emit: (envelope) => write(envelope) };
}

function write(envelope: Envelope): void {
  if (envelope.kind === "expect.passed") process.stdout.write(".");
  else if (envelope.kind === "expect.failed") process.stdout.write("F");
  else if (envelope.kind === "run.finished") writeSummary(envelope);
}

function writeSummary(envelope: Envelope): void {
  const data = envelope.data as { passed: number; failed: number; durationMs: number };
  process.stdout.write(`\n${data.passed} passed, ${data.failed} failed (${data.durationMs}ms)\n`);
}
