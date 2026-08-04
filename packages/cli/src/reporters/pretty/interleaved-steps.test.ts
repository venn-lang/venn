import { describe, expect, it } from "vitest";
import {
  AT,
  captureStdout,
  finished,
  flow,
  flowDone,
  raised,
  said,
  started,
} from "../events.suite.js";
import type { Reporter } from "../reporter.types.js";
import { createPrettyReporter } from "./pretty-reporter.js";

/** Everything the tree reporter writes while it is driven. */
function capture(drive: (reporter: Reporter) => void): string {
  return captureStdout(() => drive(createPrettyReporter()));
}

const ASSERTION = {
  code: "VN6001",
  title: "Expectation failed: expect res.status == 201",
  span: { uri: "flows/checkout.vn", line: 10, column: 5 },
};

const THROWN = {
  code: "VN7001",
  title: "The action failed: connect ECONNREFUSED",
  span: { uri: "flows/checkout.vn", line: 6, column: 3 },
};

/**
 * `parallel` and `race` are kernel statements, so two steps open at once with no
 * `step.finished` between them is a shape the language emits by design: the
 * runtime dispatches the child statements through a pool.
 *
 * Keyed by one live step, the second `step.started` overwrote the first's title,
 * logs, failures and start time, so alpha's log printed under beta's name,
 * alpha's failure was summarised with no step name at all, and both durations
 * were measured from whichever step happened to start last. Every case here
 * interleaves, because that is what the runtime does.
 */
describe("two steps open at once", () => {
  it("files a log and a failure on the step that emitted them", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Alpha", step: "a" }));
      reporter.sink.emit(started({ title: "Beta", step: "b" }));
      reporter.sink.emit(said({ message: "alpha said this", step: "a" }));
      reporter.sink.emit(raised({ problem: ASSERTION, step: "a" }));
      reporter.sink.emit(finished({ title: "Alpha", status: "failed", step: "a" }));
      reporter.sink.emit(finished({ title: "Beta", step: "b" }));
      reporter.finish({ passed: 1, failed: 1, files: 1, ms: 9 });
    });

    expect(output).toContain("Checkout › Alpha");
    expect(output).not.toContain("Checkout › Beta");
    // Both landed under alpha's verdict, which comes before beta's.
    expect(output.indexOf("alpha said this")).toBeGreaterThan(output.indexOf("✗ Alpha"));
    expect(output.indexOf("alpha said this")).toBeLessThan(output.indexOf("✓ Beta"));
  });

  /** The reproduction from the issue: two branches, two logs, two failures. */
  it("gives each branch its own failure, its own log and its own duration", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Fan out"));
      reporter.sink.emit(started({ title: "Alpha", step: "a" }));
      reporter.sink.emit(started({ title: "Beta", step: "b", ts: at("010") }));
      reporter.sink.emit(said({ message: "from alpha", step: "a" }));
      reporter.sink.emit(said({ message: "from beta", step: "b" }));
      reporter.sink.emit(raised({ problem: ASSERTION, step: "a" }));
      reporter.sink.emit(raised({ problem: THROWN, kind: "failure", step: "b" }));
      reporter.sink.emit(finished({ title: "Alpha", status: "failed", step: "a", ts: at("050") }));
      reporter.sink.emit(finished({ title: "Beta", status: "failed", step: "b", ts: at("090") }));
      reporter.finish({ passed: 0, failed: 2, files: 1, ms: 90 });
    });
    const lines = output.split("\n");

    expect(output).toContain("Fan out › Alpha");
    expect(output).toContain("Fan out › Beta");
    expect(output).toContain("VN6001");
    expect(output).toContain("VN7001");
    // Each measured from its own start, not from whichever step started last.
    expect(lines.find((line) => line.includes("✗ Alpha"))).toContain("50ms");
    expect(lines.find((line) => line.includes("✗ Beta"))).toContain("80ms");
    expect(output.indexOf("from alpha")).toBeLessThan(output.indexOf("✗ Beta"));
    expect(output.indexOf("from beta")).toBeGreaterThan(output.indexOf("✗ Beta"));
  });

  /** A `race` that a winner ended leaves the losers with no verdict coming. */
  it("still says what a step that was cut short had collected", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Race"));
      reporter.sink.emit(started({ title: "Slow", step: "a" }));
      reporter.sink.emit(said({ message: "halfway through", step: "a" }));
      reporter.sink.emit(raised({ problem: THROWN, kind: "failure", step: "a" }));
      reporter.sink.emit(flowDone({ title: "Race", status: "cancelled" }));
      reporter.finish({ passed: 0, failed: 1, files: 1, ms: 4 });
    });

    expect(output).toContain("- Slow");
    expect(output).toContain("halfway through");
    expect(output).toContain("Race › Slow");
  });
});

/** The same instant, milliseconds apart. */
function at(millis: string): string {
  return AT.replace("000Z", `${millis}Z`);
}
