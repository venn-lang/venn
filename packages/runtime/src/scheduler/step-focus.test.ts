import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink, type MemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";

function stepsRun(sink: MemorySink): string[] {
  return sink.envelopes
    .filter((event) => event.kind === "step.started")
    .map((event) => String((event.data as { title?: unknown }).title ?? ""));
}

async function run(source: string) {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const sink = createMemorySink();
  const result = await createRunner({
    host: createTestHost(),
    plugins: [],
    sink,
  }).run(ast);
  return { result, steps: stepsRun(sink) };
}

describe("@skip on a step", () => {
  it("drops the step instead of running it", async () => {
    const { result, steps } = await run(`flow "F" {
  step "kept" { expect true }
  @skip
  step "dropped" { expect false }
}`);

    expect(steps).toEqual(["kept"]);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
  });
});

describe("@only on a step", () => {
  it("focuses the steps that asked for it, among the steps beside them", async () => {
    const { result, steps } = await run(`flow "F" {
  step "other" { expect false }
  @only
  step "focused" { expect true }
  @only
  step "focused too" { expect true }
}`);

    expect(steps).toEqual(["focused", "focused too"]);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("does not reach into another flow's steps", async () => {
    const { steps } = await run(`flow "A" {
  @only
  step "a1" { expect true }
  step "a2" { expect true }
}
flow "B" {
  step "b1" { expect true }
}`);

    expect(steps).toEqual(["a1", "b1"]);
  });

  it("gives way to @skip on the same step, as it does on a flow", async () => {
    const { steps } = await run(`flow "F" {
  @only
  @skip
  step "both" { expect false }
  step "plain" { expect true }
}`);

    expect(steps).toEqual([]);
  });

  it("focuses within the block it was written in, leaving other blocks whole", async () => {
    const { steps } = await run(`flow "F" {
  step "outer" { expect true }
  group "g" {
    step "inner" { expect true }
    @only
    step "inner focused" { expect true }
  }
}`);

    expect(steps).toEqual(["outer", "inner focused"]);
  });
});
