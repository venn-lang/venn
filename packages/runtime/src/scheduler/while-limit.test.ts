import { createTestHost } from "@venn-lang/contracts";
import { ProblemError, parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function runnerWith(sink: MemorySink) {
  return createRunner({ host: createTestHost(), plugins: [], sink });
}

// The condition reads a counter the body forgets to move: the loop the cap exists for.
const FOREVER = `let n = 0
while n < 10 { const x = n }`;

describe("while and its iteration cap", () => {
  it("reports the loop that never finished instead of passing at the limit", async () => {
    const { ast, problems } = parse(FOREVER);
    expect(problems).toEqual([]);

    const failure = await runnerWith(createMemorySink())
      .script(ast)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProblemError);
    expect((failure as ProblemError).problem).toMatchObject({
      code: "VN8002",
      title: "This while loop ran 100000 times and its condition was still true.",
      severity: "error",
    });
    expect((failure as ProblemError).problem.span.line).toBe(2);
  });

  it("counts it as a failure of the flow it ran in", async () => {
    const { ast } = parse(`flow "F" {
  step "s" {
    let n = 0
    while n < 10 { const x = n }
  }
}`);

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.failed).toBe(1);
  });

  it("leaves a loop that ends of its own accord alone", async () => {
    const { ast } = parse(`flow "F" {
  step "s" {
    let n = 0
    while n < 10 {
      expect true
      break
    }
  }
}`);

    const result = await runnerWith(createMemorySink()).run(ast);

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });
});
