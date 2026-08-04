import { createTestHost } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { defineAction, defineMatcher, definePlugin, z } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

interface Calls {
  noop: number;
}

function testPlugin(calls: Calls) {
  return definePlugin({
    name: "@t/m",
    version: "0",
    namespace: "t",
    actions: [
      defineAction({
        name: "noop",
        run: () => {
          calls.noop += 1;
        },
      }),
    ],
    matchers: [
      defineMatcher({
        name: "oneOf",
        test: ({ subject, args }) => Array.isArray(args[0]) && args[0].includes(subject),
        message: ({ subject }) => `expected ${String(subject)} to be listed`,
        detail: ({ subject, args }) => ({ expected: args[0], actual: subject }),
      }),
      // Always fails: it is here to inspect what a failure carries.
      defineMatcher({
        name: "neverMatches",
        test: () => false,
        message: () => "expected the two to match",
        detail: ({ subject, args }) => ({ expected: args[0], actual: subject }),
      }),
      defineMatcher({
        name: "closeTo",
        params: z.object({ within: z.number() }),
        test: ({ subject, args, params }) =>
          Math.abs(Number(subject) - Number(args[0])) <= params.within,
        message: ({ subject }) => `expected ${String(subject)} to be close`,
      }),
      defineMatcher({
        name: "resolvesTrue",
        test: async () => true,
        message: () => "async matcher failed",
      }),
    ],
  });
}

async function run(source: string) {
  const calls: Calls = { noop: 0 };
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const sink = createMemorySink();
  const runner = createRunner({ host: createTestHost(), plugins: [testPlugin(calls)], sink });
  return { result: await runner.run(ast), calls, sink };
}

function failure(sink: MemorySink): Problem {
  const problems = sink.envelopes.flatMap((envelope) =>
    "problem" in envelope.data ? [envelope.data.problem] : [],
  );
  const first = problems[0];
  if (!first) throw new Error("no failure was reported");
  return first;
}

describe("bareword matchers", () => {
  it("passes a registry matcher, and stops the step on the one that fails", async () => {
    const { result, sink } = await run(`flow "F" {
  step "s" {
    let plan = "pro"
    expect plan oneOf ["free", "pro"]
    expect plan oneOf ["a", "b"]
    expect plan oneOf ["c", "d"]
  }
}`);
    // The third check never ran: after the second failed, the rest of the step
    // would be working against a state already known to be wrong.
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(failure(sink).title).toBe("expected pro to be listed");
  });

  it("validates matcher opts and applies them (closeTo)", async () => {
    const { result } = await run(`flow "F" {
  step "s" {
    let total = 99.005
    expect total closeTo 99.0 { within: 0.01 }
  }
}`);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("negates a matcher with `not`", async () => {
    const { result } = await run(`flow "F" {
  step "s" {
    let plan = "pro"
    expect not plan oneOf ["a", "b"]
  }
}`);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("awaits an async matcher", async () => {
    const { result } = await run(`flow "F" {
  step "s" { expect 1 resolvesTrue }
}`);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });
});

describe("what a failed matcher reports", () => {
  it("carries the two sides as a structured diff, labelled with the subject", async () => {
    const { sink } = await run(`flow "F" {
  step "s" {
    let want = { status: "paid", total: 99 }
    let row = { status: "pending", total: 99 }
    expect row neverMatches want
  }
}`);

    expect(failure(sink).diff).toEqual({
      kind: "fields",
      label: "row",
      entries: [
        { path: ".status", expected: '"paid"', actual: '"pending"', same: false },
        { path: ".total", expected: "99", actual: "99", same: true },
      ],
    });
  });

  it("falls back to a plain pair when the sides are not the same shape", async () => {
    const { sink } = await run(`flow "F" {
  step "s" {
    let plan = "enterprise"
    expect plan oneOf ["free", "pro"]
  }
}`);

    expect(failure(sink).diff).toEqual({
      kind: "scalar",
      expected: '["free", "pro"]',
      actual: '"enterprise"',
    });
  });

  it("leaves a negated failure without a diff: under `not` the two sides matched", async () => {
    const { sink } = await run(`flow "F" {
  step "s" {
    let plan = "pro"
    expect not plan oneOf ["free", "pro"]
  }
}`);

    const problem = failure(sink);
    expect(problem.diff).toBeUndefined();
    expect(problem.title).toContain("pro");
  });
});

describe("statement terminators", () => {
  it("separates statements by newline and `;`; a matcher never slurps the next statement", async () => {
    const { result, calls } = await run(`flow "F" {
  step "s" {
    expect true
    t.noop
    expect 1 == 1; t.noop
  }
}`);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
    expect(calls.noop).toBe(2);
  });
});
