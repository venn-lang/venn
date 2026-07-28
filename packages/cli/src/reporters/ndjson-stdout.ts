import { createNdjsonSink, type EventSink } from "@venn/runtime";

/**
 * An event sink that writes each envelope to stdout as one line of NDJSON: the
 * stream a script or a CI job parses.
 */
export function createStdoutSink(): EventSink {
  return createNdjsonSink({
    write: (line) => {
      process.stdout.write(line);
    },
  });
}
