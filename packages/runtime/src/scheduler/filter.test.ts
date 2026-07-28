import { createTestHost } from "@venn-lang/contracts";
import { parse } from "@venn-lang/core";
import { describe, expect, it } from "vitest";
import { createMemorySink } from "../eventsink/index.js";
import { createRunner } from "../run/create-runner.js";
import type { RunFilter } from "./filter.types.js";

const SOURCE = `flow "Alpha" {
  step "one" { expect true }
  step "two" { expect true }
}
flow "Beta" {
  step "one" { expect true }
}`;

const FAILING = `flow "Primeiro" {
  step "breaks" { expect 1 == 2 }
}
flow "Segundo" {
  step "breaks too" { expect 1 == 2 }
}`;

async function run(source: string, filter: RunFilter, bail?: boolean) {
  const { ast, problems } = parse(source);
  expect(problems).toEqual([]);
  const runner = createRunner({
    host: createTestHost(),
    plugins: [],
    sink: createMemorySink(),
    filter,
    bail,
  });
  return runner.run(ast);
}

describe("run filters", () => {
  it("runs everything when nothing is filtered", async () => {
    expect((await run(SOURCE, {})).passed).toBe(3);
  });

  it("keeps only the flows whose title matches, case-insensitively", async () => {
    expect((await run(SOURCE, { flow: "alpha" })).passed).toBe(2);
  });

  it("keeps only the steps whose title matches", async () => {
    expect((await run(SOURCE, { step: "two" })).passed).toBe(1);
  });

  it("combines the flow and step filters", async () => {
    expect((await run(SOURCE, { flow: "Beta", step: "one" })).passed).toBe(1);
  });

  it("matches nothing when no title contains the needle", async () => {
    expect((await run(SOURCE, { flow: "nowhere" })).passed).toBe(0);
  });
});

describe("bail", () => {
  it("stops after the first failing flow", async () => {
    expect((await run(FAILING, {}, true)).failed).toBe(1);
  });

  it("runs every flow when bail is off", async () => {
    expect((await run(FAILING, {})).failed).toBe(2);
  });
});
