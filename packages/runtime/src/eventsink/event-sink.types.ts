import type { Envelope } from "@venn/core";

/** The destination of the event stream. Everything the UI shows derives from it. */
export interface EventSink {
  emit(envelope: Envelope): void;
}

/** An EventSink that also retains every envelope (the test double). */
export interface MemorySink extends EventSink {
  readonly envelopes: readonly Envelope[];
}
