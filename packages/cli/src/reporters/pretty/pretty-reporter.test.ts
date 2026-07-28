import type { Envelope } from "@venn-lang/core";
import { describe, expect, it, vi } from "vitest";
import type { Reporter } from "../reporter.types.js";
import { createPrettyReporter } from "./pretty-reporter.js";

function envelope(kind: string, data: unknown, ts = "2026-07-24T10:00:00.000Z"): Envelope {
  return { seq: 1, ts, run: "run-1", kind, data } as unknown as Envelope;
}

function capture(drive: (reporter: Reporter) => void): string {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    drive(createPrettyReporter());
  } finally {
    spy.mockRestore();
  }
  return chunks.join("");
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

describe("pretty reporter", () => {
  it("draws a tree of flows and steps with their verdicts", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/checkout.vn");
      reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
      reporter.sink.emit(envelope("step.started", { title: "Ping" }));
      const finished = { title: "Ping", status: "passed" };
      reporter.sink.emit(envelope("step.finished", finished, "2026-07-24T10:00:00.120Z"));
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
      reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
      reporter.sink.emit(envelope("step.started", { title: "Charge" }));
      reporter.sink.emit(envelope("expect.failed", { problem: PROBLEM }));
      reporter.sink.emit(envelope("step.finished", { title: "Charge", status: "failed" }));
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
      reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
      reporter.sink.emit(envelope("step.started", { title: "Reconcile" }));
      reporter.sink.emit(envelope("expect.failed", { problem: WITH_DIFF }));
      reporter.sink.emit(envelope("step.finished", { title: "Reconcile", status: "failed" }));
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
      reporter.sink.emit(envelope("flow.started", { title: "A" }));
      reporter.beginFile("flows/b.vn");
      reporter.sink.emit(envelope("flow.started", { title: "B" }));
      reporter.finish({ passed: 4, failed: 0, files: 2, ms: 40 });
    });

    expect(output.match(/RUN/g)).toHaveLength(2);
    expect(output).toContain("a.vn");
    expect(output).toContain("b.vn");
    expect(output.match(/Tests/g)).toHaveLength(1);
    expect(output).toContain("Files");
  });

  it("reports an error thrown mid-flow, which arrives as a log", () => {
    const output = capture((reporter) => {
      reporter.beginFile("flows/checkout.vn");
      reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
      reporter.sink.emit(envelope("log", { level: "error", message: "connect ECONNREFUSED" }));
      reporter.finish({ passed: 0, failed: 1, files: 1, ms: 3 });
    });

    expect(output).toContain("connect ECONNREFUSED");
    expect(output).toContain("VN7001");
  });

  it("prints an info `log` under its step, the way console output shows in vitest", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(envelope("flow.started", { title: "Demo" }));
      reporter.sink.emit(envelope("step.started", { title: "logs" }));
      reporter.sink.emit(envelope("log", { level: "info", message: "hello" }));
      reporter.sink.emit(envelope("log", { level: "info", message: '{"n":42}' }));
      const done = { title: "logs", status: "passed" };
      reporter.sink.emit(envelope("step.finished", done, "2026-07-24T10:00:00.001Z"));
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
      reporter.sink.emit(envelope("expect.failed", { problem: HOOK }));
      reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
      reporter.sink.emit(envelope("step.started", { title: "Charge" }));
      reporter.sink.emit(envelope("step.finished", { title: "Charge", status: "passed" }));
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
      reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
      reporter.sink.emit(envelope("step.started", { title: "Charge" }));
      reporter.sink.emit(envelope("step.finished", { title: "Charge", status: "passed" }));
      reporter.sink.emit(envelope("flow.finished", { title: "Checkout", status: "passed" }));
      reporter.sink.emit(envelope("expect.failed", { problem: HOOK }));
      reporter.finish({ passed: 1, failed: 1, files: 1, ms: 5 });
    });

    expect(output).toContain("setup failed: db is down");
    expect(output).not.toContain("Checkout › Charge");
  });

  it("keeps a step's logs out of the failures summary", () => {
    const output = capture((reporter) => {
      reporter.sink.emit(envelope("flow.started", { title: "Demo" }));
      reporter.sink.emit(envelope("step.started", { title: "s" }));
      reporter.sink.emit(envelope("log", { level: "info", message: "just noise" }));
      reporter.sink.emit(envelope("step.finished", { title: "s", status: "passed" }));
      reporter.finish({ passed: 1, failed: 0, files: 1, ms: 1 });
    });

    expect(output).not.toContain("FAILURES");
  });
});
