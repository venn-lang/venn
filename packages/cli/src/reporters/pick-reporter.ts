import type { EventSink } from "@venn-lang/runtime";
import { createDotSink } from "./dot-sink.js";
import { createJunitReporter } from "./junit-reporter.js";
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
  if (name === "junit") return createJunitReporter({ write: (xml) => process.stdout.write(xml) });
  return process.stdout.isTTY ? createPrettyReporter() : passive(createStdoutSink());
}

// NDJSON and dot say everything as it happens, straight out: neither has a file
// boundary to draw nor an end of run to hold anything for. JUnit does, since one
// invocation is one document.
function passive(sink: EventSink): Reporter {
  return { sink, beginFile: () => {}, finish: () => {} };
}
