import type { Envelope } from "@venn/core";
import type { MemorySink } from "./event-sink.types.js";

/**
 * In-memory sink (the test double): keeps every envelope for assertions.
 *
 * @returns A sink whose `envelopes` array grows in emission order.
 */
export function createMemorySink(): MemorySink {
  const envelopes: Envelope[] = [];
  return {
    envelopes,
    emit: (envelope) => {
      envelopes.push(envelope);
    },
  };
}
