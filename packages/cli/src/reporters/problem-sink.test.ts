import type { Envelope } from "@venn-lang/core";
import { describe, expect, it, vi } from "vitest";
import { createProblemSink } from "./problem-sink.js";

function envelope(kind: string, data: unknown): Envelope {
  return {
    seq: 1,
    ts: "2026-07-25T10:00:00.000Z",
    run: "run-1",
    kind,
    data,
  } as unknown as Envelope;
}

function capture(drive: (sink: ReturnType<typeof createProblemSink>) => void): string {
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
};

describe("createProblemSink", () => {
  // A program's `setup` that throws is no longer thrown out of the run, so this
  // is the only thing standing between it and a silent exit.
  it("says why the run failed, on stderr", () => {
    const output = capture((sink) => sink.emit(envelope("expect.failed", { problem: HOOK })));

    expect(output).toContain("VN7004");
    expect(output).toContain("setup failed: db is down");
    expect(output).toContain("app.vn:1:1");
  });

  it("leaves the rest of the stream alone — the program owns its output", () => {
    const output = capture((sink) => {
      sink.emit(envelope("log", { level: "info", message: "hello" }));
      sink.emit(envelope("run.finished", { passed: 1, failed: 0, durationMs: 1 }));
    });

    expect(output).toBe("");
  });
});
