import type { EventSink } from "./event-sink.types.js";

/**
 * NDJSON sink: one JSON envelope per line. The `write` sink is injected (the CLI
 * passes stdout) so this file stays neutral and needs no `node:*`.
 *
 * @param args.write Receives each line, newline included.
 * @returns A sink that serialises every envelope it is given.
 */
export function createNdjsonSink(args: { write: (line: string) => void }): EventSink {
  return {
    emit: (envelope) => args.write(`${JSON.stringify(envelope)}\n`),
  };
}
