import type { EventSink } from "@venn-lang/runtime";
import { describe, expect, it, vi } from "vitest";
import { envelope, raised, runDone, said } from "./events.suite.js";
import { createProblemSink } from "./problem-sink.js";

function capture(drive: (sink: EventSink) => void): string {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    drive(createProblemSink());
  } finally {
    spy.mockRestore();
  }
  return chunks.join("");
}

const HOOK = {
  code: "VN7004",
  title: "setup failed: db is down",
  span: { uri: "app.vn", line: 1, column: 1 },
  help: "Start the database, or point the flow at a fake.",
};

describe("createProblemSink", () => {
  // A program's `setup` that throws is no longer thrown out of the run, so this
  // is the only thing standing between it and a silent exit.
  it("says why the run failed, on stderr", () => {
    const output = capture((sink) => sink.emit(raised({ problem: HOOK })));

    expect(output).toContain("VN7004");
    expect(output).toContain("setup failed: db is down");
    expect(output).toContain("app.vn:1:1");
    expect(output).toContain("Start the database");
  });

  /** A verb that threw is no more silent than an assertion that lost. */
  it("says a failure that was never an assertion, and a soft one", () => {
    const output = capture((sink) => {
      sink.emit(raised({ problem: HOOK, kind: "failure" }));
      sink.emit(raised({ problem: HOOK, kind: "expect.soft_failed" }));
    });

    expect(output.match(/VN7004/g)).toHaveLength(2);
  });

  it("leaves the rest of the stream alone, the program owns its output", () => {
    const output = capture((sink) => {
      sink.emit(said({ message: "hello" }));
      sink.emit(envelope({ kind: "expect.passed", data: { source: "1 == 1" } }));
      sink.emit(runDone({ passed: 1, failed: 0 }));
    });

    expect(output).toBe("");
  });
});
