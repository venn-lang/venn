import { createTestHost } from "@venn/contracts";
import { ProblemError, parse } from "@venn/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function runnerWith(sink: MemorySink) {
  return createRunner({ host: createTestHost(), plugins: [], sink });
}

// The everyday shape of it: a count read from config that is not there.
const MISSING_COUNT = `flow "F" {
  step "s" {
    const cfg = { time: 3 }
    repeat cfg.times { expect true }
  }
}`;

describe("repeat over something that is not a number", () => {
  it("fails the run instead of running the body zero times and passing", async () => {
    const { ast, problems } = parse(MISSING_COUNT);
    expect(problems).toEqual([]);

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
  });

  it("says what it got, and where", async () => {
    const { ast } = parse('let times = "3"\nrepeat times { log "once" }');

    const failure = (await runnerWith(createMemorySink())
      .script(ast)
      .catch((error: unknown) => error)) as ProblemError;

    expect(failure).toBeInstanceOf(ProblemError);
    expect(failure.problem).toMatchObject({
      code: "VN3016",
      title: "repeat needs a number of times, and this is a string.",
      severity: "error",
    });
    expect(failure.problem.span.line).toBe(2);
  });

  it("leaves a count of zero alone — a program may ask for nothing", async () => {
    const { ast } = parse('flow "F" { step "s" { repeat 0 { expect false } } }');

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(0);
  });

  it("still runs a real count", async () => {
    const { ast } = parse('flow "F" { step "s" { repeat 3 as n { expect n <= 3 } } }');

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
  });
});
