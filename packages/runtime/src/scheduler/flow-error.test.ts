import { createTestHost } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function runnerWith(sink: MemorySink) {
  return createRunner({ host: createTestHost(), plugins: [], sink });
}

function problemsIn(sink: MemorySink): Problem[] {
  return sink.envelopes
    .filter((envelope) => envelope.kind === "expect.failed")
    .map((envelope) => (envelope.data as { problem: Problem }).problem);
}

function errorLogs(sink: MemorySink): string[] {
  return sink.envelopes
    .filter((envelope) => envelope.kind === "log")
    .filter((envelope) => (envelope.data as { level?: unknown }).level === "error")
    .map((envelope) => String((envelope.data as { message?: unknown }).message ?? ""));
}

const OVER_A_MAP = `flow "F" {
  step "s" {
    const res = { data: [1] }
    forEach item in res { expect item > 0 }
  }
}`;

describe("a failure a flow could not handle", () => {
  // Flattened to a log line, the code and the location were gone: every reporter
  // read it as VN7001 "somewhere", whatever the runtime had actually raised.
  it("reaches the reporters as the Problem it is, code and span and all", async () => {
    const sink = createMemorySink();
    const { ast, problems } = parse(OVER_A_MAP);
    expect(problems).toEqual([]);

    await runnerWith(sink).run(ast);

    expect(problemsIn(sink)).toMatchObject([
      {
        code: "VN3015",
        title: "forEach needs a list, and this is a map.",
        span: { line: 4 },
        help: "Name the list inside it, as in `forEach item in res.data`.",
      },
    ]);
  });

  it("still reports one that carries no Problem of its own", async () => {
    const sink = createMemorySink();
    const { ast } = parse('flow "F" { step "s" { fail "db is down" } }');

    const result = await runnerWith(sink).run(ast);

    expect(result.failed).toBe(1);
    expect(errorLogs(sink)).toEqual(["db is down"]);
  });
});
