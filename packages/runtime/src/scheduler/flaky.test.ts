import { createTestHost } from "@venn/contracts";
import { parse } from "@venn/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

// The step runs 4 times and fails exactly once (n === 2), an observed ratio of 0.25.
function source(ratio: string): string {
  return `flow "F" {
  repeat 4 as n {
    @flaky(ratio: ${ratio})
    step "s" {
      expect n != 2
    }
  }
}`;
}

async function run(ratio: string) {
  const { ast, problems } = parse(source(ratio));
  expect(problems).toEqual([]);
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink: createMemorySink(),
  });
  return runner.run(ast);
}

describe("@flaky(ratio)", () => {
  it("forgives failures that stay within the declared tolerance", async () => {
    const result = await run("0.5");

    expect(result.passed).toBe(3);
    expect(result.failed).toBe(0);
  });

  it("keeps the failure when the observed ratio exceeds the tolerance", async () => {
    const result = await run("0.1");

    expect(result.failed).toBe(1);
  });
});
