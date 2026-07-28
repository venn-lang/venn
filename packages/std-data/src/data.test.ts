import type { ActionContext, ActionDefinition } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { dataActions } from "./actions/index.js";
import { dataPlugin } from "./plugin.js";
import { resetRng } from "./rng/index.js";

const ctx = {} as ActionContext;

function find(name: string): ActionDefinition {
  const action = dataActions.find((candidate) => candidate.name === name);
  if (!action) throw new Error(`no action ${name}`);
  return action;
}

function run(name: string, ...args: unknown[]): unknown {
  return find(name).run(ctx, { args, params: {} });
}

describe("data plugin", () => {
  it("exposes the data namespace with every verb", () => {
    expect(dataPlugin.namespace).toBe("data");
    const names = dataActions.map((action) => action.name);
    expect(names).toContain("faker.email");
    expect(names).toContain("faker.creditCard");
    expect(names).toEqual(expect.arrayContaining(["oneOf", "range", "shuffle", "csv", "json"]));
  });
});

// The faker catalogue has its own suite: faker/faker.test.ts.

describe("data oneOf / range", () => {
  it("oneOf only ever returns one of the given args", () => {
    resetRng();
    for (let i = 0; i < 25; i += 1) {
      expect(["free", "pro"]).toContain(run("oneOf", "free", "pro"));
    }
  });

  it("range stays within the inclusive bounds and is integral", () => {
    resetRng();
    for (let i = 0; i < 50; i += 1) {
      const n = Number(run("range", 1, 10));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(10);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});

describe("data shuffle", () => {
  it("preserves the elements and does not mutate the input", () => {
    resetRng();
    const input = [1, 2, 3, 4, 5];
    const out = run("shuffle", input) as number[];
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic across a reset", () => {
    resetRng();
    const first = run("shuffle", [1, 2, 3, 4, 5, 6, 7, 8]);
    resetRng();
    const second = run("shuffle", [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(second).toEqual(first);
  });
});

describe("data csv / json", () => {
  it("parses CSV using the header row", () => {
    const rows = run("csv", "name,plan\nada,pro\nlinus,free");
    expect(rows).toEqual([
      { name: "ada", plan: "pro" },
      { name: "linus", plan: "free" },
    ]);
  });

  it("parses JSON strings", () => {
    expect(run("json", '{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });
});
