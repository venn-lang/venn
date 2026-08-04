import type { Envelope } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createDotSink } from "./dot-sink.js";
import { captureStdout, envelope, raised, runDone, said } from "./events.suite.js";

const PROBLEM = { code: "VN7001", title: "The action failed.", span: { uri: "a.vn", line: 1 } };

/** What the sink prints for a stream of events. */
function dots(...envelopes: readonly Envelope[]): string {
  const sink = createDotSink();
  return captureStdout(() => {
    for (const one of envelopes) sink.emit(one);
  });
}

/**
 * One character per event, and a legend that does not lie.
 *
 * `F` stood for an assertion that failed and for a hook that blew up, so a
 * stream of dots claimed expectations that nothing ever expected. A failure has
 * its own envelopes now, and its own character.
 */
describe("a run as characters", () => {
  it("marks an assertion that passed and one that failed", () => {
    const passed = envelope({ kind: "expect.passed", data: { source: "res.status == 200" } });

    expect(dots(passed, raised({ problem: PROBLEM }), passed)).toBe(".F.");
  });

  it("tells a soft failure and a failure that was never an assertion apart", () => {
    const soft = raised({ problem: PROBLEM, kind: "expect.soft_failed" });
    const thrown = raised({ problem: PROBLEM, kind: "failure" });

    expect(dots(soft, thrown)).toBe("S!");
  });

  it("says nothing for an event that is not a verdict", () => {
    expect(dots(said({ message: "noise" }))).toBe("");
  });

  it("closes with the totals the run finished on", () => {
    const output = dots(runDone({ passed: 3, failed: 1 }));

    expect(output).toContain("3 passed, 1 failed");
    expect(output).toContain("12ms");
  });
});
