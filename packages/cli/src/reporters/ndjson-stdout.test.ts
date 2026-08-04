import type { Envelope } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { captureStdout, raised, runDone, started } from "./events.suite.js";
import { createStdoutSink } from "./ndjson-stdout.js";

const PROBLEM = {
  code: "VN6001",
  title: 'expected "pending" to equal "paid"',
  span: { uri: "flows/checkout.vn", line: 10, column: 5 },
};

/** Every line the sink wrote, parsed back. */
function stream(...envelopes: readonly Envelope[]): Envelope[] {
  const sink = createStdoutSink();
  const written = captureStdout(() => {
    for (const one of envelopes) sink.emit(one);
  });
  return written
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Envelope);
}

/**
 * The stream a script or a CI job parses, and what `venn run` writes when its
 * output is piped. One envelope per line, whole: a consumer that has to guess
 * has no contract.
 */
describe("a run as ndjson on stdout", () => {
  it("writes one line per envelope, each one parseable on its own", () => {
    const lines = stream(
      started({ title: "Charge", step: "a" }),
      runDone({ passed: 1, failed: 0 }),
    );

    expect(lines.map((one) => one.kind)).toEqual(["step.started", "run.finished"]);
    expect(lines[0]?.step).toBe("a");
  });

  /** A reader that only has the stream needs the problem, not a title. */
  it("carries a failure's problem whole, on the envelope that raised it", () => {
    const [line] = stream(raised({ problem: PROBLEM, kind: "failure", step: "a" }));
    const data = line?.data as { problem: typeof PROBLEM };

    expect(line?.kind).toBe("failure");
    expect(data.problem.code).toBe("VN6001");
    expect(data.problem.span.line).toBe(10);
  });

  it("keeps a newline between two envelopes so a reader can split on it", () => {
    const sink = createStdoutSink();
    const written = captureStdout(() => {
      sink.emit(started({ title: "a", step: "a" }));
      sink.emit(started({ title: "b", step: "b" }));
    });

    expect(written.split("\n").filter(Boolean)).toHaveLength(2);
  });
});
