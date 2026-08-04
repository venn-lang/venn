import type { Envelope } from "@venn-lang/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pickReporter } from "./pick-reporter.js";

/**
 * What each name selects, told apart by what the reporter WRITES rather than by
 * its identity: the four are structurally alike, so comparing functions proves
 * nothing a rename would not also pass.
 */
function wrote(name: string | undefined, tty: boolean): string {
  const out: string[] = [];
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(String(chunk));
    return true;
  });
  // Assigned rather than spied: outside a terminal `isTTY` is an absent plain
  // property, and there is no getter for a spy to stand in front of.
  const wasTTY = process.stdout.isTTY;
  process.stdout.isTTY = tty;
  const reporter = pickReporter(name);
  reporter.beginFile("orders.vn");
  // A flow as well as an assertion: the tree defers a file's banner until
  // something in it runs, so a filtered-out file stays quiet.
  reporter.sink.emit(envelope("flow.started", { title: "Checkout" }));
  reporter.sink.emit(passed());
  reporter.sink.emit(envelope("flow.finished", { title: "Checkout", status: "passed" }));
  reporter.sink.emit(runDone());
  reporter.finish({ passed: 1, failed: 0, files: 1, ms: 1 });
  process.stdout.isTTY = wasTTY;
  stdout.mockRestore();
  return out.join("");
}

function passed(): Envelope {
  return envelope("expect.passed", { source: "expect true" });
}

function runDone(): Envelope {
  return envelope("run.finished", { passed: 1, failed: 0, durationMs: 1 });
}

function envelope(kind: string, data: unknown): Envelope {
  return { seq: 1, ts: "2026-08-04T00:00:00.000Z", run: "r", kind, data } as unknown as Envelope;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("choosing a reporter", () => {
  it("gives ndjson the whole envelope, one line at a time", () => {
    const lines = wrote("ndjson", false).trim().split("\n");

    expect(lines.map((line) => JSON.parse(line).kind)).toEqual([
      "flow.started",
      "expect.passed",
      "flow.finished",
      "run.finished",
    ]);
  });

  it("gives dot one character per assertion", () => {
    expect(wrote("dot", false)).toContain(".");
  });

  it("gives junit one XML document, closed at the end of the run", () => {
    const out = wrote("junit", false);

    expect(out.match(/<\?xml/g)).toHaveLength(1);
    expect(out).toContain("</testsuites>");
  });

  it("gives pretty a tree, whether or not the name was written out", () => {
    expect(wrote("pretty", false)).toContain("orders.vn");
  });

  /**
   * The default is what a script gets when nobody chose, so it has to stay
   * machine-readable: a pipe that started receiving a drawn tree would break
   * every consumer at once.
   */
  it("falls back to the tree on a terminal and to ndjson when piped", () => {
    expect(wrote(undefined, true)).toContain("orders.vn");
    const piped = wrote(undefined, false).trim().split("\n");
    expect(piped.map((line) => JSON.parse(line).kind)).toContain("expect.passed");
  });
});
