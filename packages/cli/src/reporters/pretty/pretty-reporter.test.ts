import { describe, expect, it } from "vitest";
import { captureStdout, finished, flow, flowDone, raised, said, started } from "../events.suite.js";
import type { Reporter } from "../reporter.types.js";
import { createPrettyReporter } from "./pretty-reporter.js";

/** Everything the tree reporter writes while it is driven. */
function capture(drive: (reporter: Reporter) => void): string {
  return captureStdout(() => drive(createPrettyReporter()));
}

const PROBLEM = {
  code: "VN6001",
  title: "Expectation failed: expect res.status == 201",
  span: { uri: "flows/checkout.vn", line: 10, column: 5 },
};

const WITH_DIFF = {
  code: "VN6001",
  title: 'expected {"status":"pending"} to equal {"status":"paid"}',
  span: { uri: "flows/checkout.vn", line: 12, column: 7 },
  diff: {
    kind: "fields",
    label: "row",
    entries: [
      { path: ".status", expected: '"paid"', actual: '"pending"', same: false },
      { path: ".total", expected: "99", actual: "99", same: true },
    ],
  },
};

const HOOK = {
  code: "VN7004",
  title: "setup failed: db is down",
  span: { uri: "flows/checkout.vn", line: 1, column: 1 },
};

const THROWN = {
  code: "VN7001",
  title: "The action failed: connect ECONNREFUSED",
  span: { uri: "flows/checkout.vn", line: 6, column: 3 },
};

describe("pretty reporter", () => {
  it("draws a tree of flows and steps with their verdicts", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/checkout.vn");
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Ping", step: "s1" }));
      const ts = "2026-07-24T10:00:00.120Z";
      reporter.sink.emit(finished({ title: "Ping", step: "s1", ts }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 120 });
    });

    expect(output).toContain("RUN");
    expect(output).toContain("checkout.vn");
    expect(output).toContain("❯ Checkout");
    expect(output).toContain("✓ Ping");
    expect(output).toContain("120ms");
    expect(output).toContain("1 passed");
  });

  it("marks a failing step and repeats it with code and location", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/checkout.vn");
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Charge", step: "s1" }));
      reporter.sink.emit(raised({ problem: PROBLEM, step: "s1" }));
      reporter.sink.emit(finished({ title: "Charge", status: "failed", step: "s1" }));
      reporter.finish({ passed: 0, failed: 1, files: 1, ms: 5 });
    });

    expect(output).toContain("✗ Charge");
    expect(output).toContain("FAILURES");
    expect(output).toContain("VN6001");
    expect(output).toContain("checkout.vn:10:5");
    expect(output).toContain("1 failed");
  });

  it("prints the diff under the failure, field by field", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Reconcile", step: "s1" }));
      reporter.sink.emit(raised({ problem: WITH_DIFF, step: "s1" }));
      reporter.sink.emit(finished({ title: "Reconcile", status: "failed", step: "s1" }));
      reporter.finish({ passed: 0, failed: 1, files: 1, ms: 9 });
    });
    const lines = output.split("\n");

    expect(lines).toContain("     row");
    expect(lines).toContain('     ├ .status  expected  "paid"');
    expect(lines).toContain('     │          actual    "pending"');
    // A field that matched is context, so it prints once instead of twice.
    expect(lines).toContain("     └ .total   same      99");
  });

  it("keeps one banner per file and one summary for the whole run", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/a.vn");
      reporter.sink.emit(flow("A"));
      reporter.beginFile("flows/b.vn");
      reporter.sink.emit(flow("B"));
      reporter.finish({ passed: 4, failed: 0, files: 2, ms: 40 });
    });

    expect(output.match(/RUN/g)).toHaveLength(2);
    expect(output).toContain("a.vn");
    expect(output).toContain("b.vn");
    expect(output.match(/Tests/g)).toHaveLength(1);
    expect(output).toContain("Files");
  });

  // A verb that blew up is not an assertion anybody made, and it used to arrive
  // as a `log` the reporter stamped VN7001 on itself. It arrives on `failure`
  // now, carrying the code and the span of whatever really went wrong.
  it("reports a failure that no assertion made, with the code it carries", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/checkout.vn");
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(raised({ problem: THROWN, kind: "failure" }));
      reporter.finish({ passed: 0, failed: 1, files: 1, ms: 3 });
    });

    expect(output).toContain("connect ECONNREFUSED");
    expect(output).toContain("VN7001");
    expect(output).toContain("checkout.vn:6:3");
  });

  it("prints an info `log` under its step, the way console output shows in vitest", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Demo"));
      reporter.sink.emit(started({ title: "logs", step: "s1" }));
      reporter.sink.emit(said({ message: "hello", step: "s1" }));
      reporter.sink.emit(said({ message: '{"n":42}', step: "s1" }));
      const ts = "2026-07-24T10:00:00.001Z";
      reporter.sink.emit(finished({ title: "logs", step: "s1", ts }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 1 });
    });

    expect(output).toContain("hello");
    expect(output).toContain('{"n":42}');
    // The step's verdict comes before the lines it logged.
    expect(output.indexOf("logs")).toBeLessThan(output.indexOf("hello"));
  });

  // A failing hook belongs to no step: `setup` fails before the first one
  // starts. Held as if it were a step's, the next `step.started` cleared it and
  // the run counted a failure it never explained.
  it("prints a failure that arrived before any step", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/checkout.vn");
      reporter.sink.emit(raised({ problem: HOOK, kind: "failure" }));
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Charge", step: "s1" }));
      reporter.sink.emit(finished({ title: "Charge", step: "s1" }));
      reporter.finish({ passed: 1, failed: 1, files: 1, ms: 5 });
    });

    expect(output).toContain("FAILURES");
    expect(output).toContain("VN7004");
    expect(output).toContain("setup failed: db is down");
    expect(output).toContain("checkout.vn:1:1");
  });

  // `teardown` fails after the last step ended, with no step.finished left to
  // flush it, and it is not the last step's fault, so it is not filed there.
  it("prints a failure that arrived after the last step, blaming no step", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Charge", step: "s1" }));
      reporter.sink.emit(finished({ title: "Charge", step: "s1" }));
      reporter.sink.emit(flowDone({ title: "Checkout" }));
      reporter.sink.emit(raised({ problem: HOOK, kind: "failure" }));
      reporter.finish({ passed: 1, failed: 1, files: 1, ms: 5 });
    });

    expect(output).toContain("setup failed: db is down");
    expect(output).not.toContain("Checkout › Charge");
  });

  it("keeps a step's logs out of the failures summary", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Demo"));
      reporter.sink.emit(started({ title: "s", step: "s1" }));
      reporter.sink.emit(said({ message: "just noise", step: "s1" }));
      reporter.sink.emit(finished({ title: "s", step: "s1" }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 1 });
    });

    expect(output).not.toContain("FAILURES");
  });

  it("says a soft failure did not stop the step", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Charge", step: "s1" }));
      reporter.sink.emit(raised({ problem: PROBLEM, kind: "expect.soft_failed", step: "s1" }));
      reporter.sink.emit(finished({ title: "Charge", step: "s1" }));
      reporter.finish({ passed: 1, failed: 1, files: 1, ms: 2 });
    });

    expect(output).toContain("✓ Charge");
    expect(output).toContain("the step carried on");
    expect(output).toContain("VN6001");
  });

  it("gives a step that was cut short neither a tick nor a cross", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Charge", step: "s1" }));
      reporter.sink.emit(finished({ title: "Charge", status: "cancelled", step: "s1" }));
      reporter.finish({ passed: 0, failed: 0, files: 1, ms: 1 });
    });

    expect(output).toContain("- Charge");
    expect(output).not.toContain("✓ Charge");
    expect(output).not.toContain("✗ Charge");
  });

  /**
   * A `log` written between two steps carries no step id, and printed at the
   * indent a step's children use it read as one of the preceding step's own
   * lines. It belongs to the flow, so it sits where the steps sit.
   */
  it("prints a log that no step said beside the steps, not under one", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(flow("Checkout"));
      reporter.sink.emit(started({ title: "Charge", step: "s1" }));
      reporter.sink.emit(finished({ title: "Charge", step: "s1" }));
      reporter.sink.emit(said({ message: "between steps" }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 1 });
    });
    const lines = output.split("\n");

    expect(lines).toContain("   › between steps");
    expect(lines).not.toContain("     › between steps");
  });
});
