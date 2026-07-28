import type { EventSink } from "@venn/runtime";
import { createDotSink } from "./dot-sink.js";
import { createJunitSink } from "./junit-sink.js";
import { createStdoutSink } from "./ndjson-stdout.js";
import { createPrettyReporter } from "./pretty/index.js";
import type { Reporter } from "./reporter.types.js";

/**
 * Choose a reporter by name. With no `--reporter`, a terminal gets the readable
 * tree and anything piped gets NDJSON, so scripts and CI keep the
 * machine-readable stream they can parse.
 */
export function pickReporter(name: string | undefined): Reporter {
  if (name === "pretty") return createPrettyReporter();
  if (name === "ndjson") return passive(createStdoutSink());
  if (name === "dot") return passive(createDotSink());
  if (name === "junit") return passive(junit());
  return process.stdout.isTTY ? createPrettyReporter() : passive(createStdoutSink());
}

// Machine formats say everything they need through the event stream itself.
function passive(sink: EventSink): Reporter {
  return { sink, beginFile: () => {}, finish: () => {} };
}

function junit(): EventSink {
  return createJunitSink({ write: (xml) => process.stdout.write(xml) });
}
