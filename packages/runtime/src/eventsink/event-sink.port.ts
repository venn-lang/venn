import type { Port } from "@venn-lang/contracts";
import type { EventSink } from "./event-sink.types.js";

/**
 * The port every run event is written to. Bound at startup by whoever assembles
 * the host: the CLI binds NDJSON on stdout, tests bind the memory double.
 */
export const EventSinkPort: Port<EventSink> = {
  id: "venn.port.event-sink",
  version: 1,
  requires: [],
  methods: ["emit"],
};
