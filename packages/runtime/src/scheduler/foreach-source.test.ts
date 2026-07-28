import { createTestHost } from "@venn-lang/contracts";
import { ProblemError, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function runnerWith(sink: MemorySink) {
  return createRunner({ host: createTestHost(), plugins: [], sink });
}

const OVER_A_MAP = `flow "F" {
  step "s" {
    const res = { data: [1, 2, 3] }
    forEach item in res { expect item > 0 }
  }
}`;

describe("forEach over something that is not a list", () => {
  it("fails the run instead of iterating zero times and passing", async () => {
    const { ast, problems } = parse(OVER_A_MAP);
    expect(problems).toEqual([]);

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
  });

  it("says what it got, and where", async () => {
    const { ast } = parse("const res = { data: [1] }\nforEach item in res { log item }");

    const failure = await runnerWith(createMemorySink())
      .script(ast)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProblemError);
    expect((failure as ProblemError).problem).toMatchObject({
      code: "VN3015",
      title: "forEach needs a list, and this is a map.",
      severity: "error",
      help: "Name the list inside it, as in `forEach item in res.data`.",
    });
  });

  it("points at the source expression, not at the whole loop", async () => {
    const { ast } = parse("const res = 42\nforEach item in res { log item }");

    const failure = (await runnerWith(createMemorySink())
      .script(ast)
      .catch((error: unknown) => error)) as ProblemError;

    expect(failure.problem.title).toBe("forEach needs a list, and this is a number.");
    expect(failure.problem.span.line).toBe(2);
    expect(failure.problem.span.length).toBe("res".length);
  });

  it("still iterates a list", async () => {
    const { ast } = parse('flow "F" { step "s" { forEach n in [1, 2] { expect n > 0 } } }');

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
  });
});
