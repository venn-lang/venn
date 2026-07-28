import type { Envelope } from "@venn-lang/core";
import { eventSinkConformance } from "./event-sink.suite.js";
import { createMemorySink } from "./memory-sink.js";
import { createNdjsonSink } from "./ndjson-sink.js";

eventSinkConformance({
  name: "memory",
  make: () => {
    const sink = createMemorySink();
    return { sink, drain: () => [...sink.envelopes] };
  },
});

eventSinkConformance({
  name: "ndjson",
  make: () => {
    const lines: string[] = [];
    const sink = createNdjsonSink({ write: (line) => lines.push(line) });
    return { sink, drain: () => lines.map((line) => JSON.parse(line) as Envelope) };
  },
});
