import type { ActionContext, ActionDefinition } from "@venn-lang/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { mockActions } from "./actions/index.js";
import { mockPlugin } from "./plugin.js";
import { getMockState, resetMockState } from "./state/index.js";

const ctx = {} as ActionContext;

function find(name: string): ActionDefinition {
  const action = mockActions.find((candidate) => candidate.name === name);
  if (!action) throw new Error(`no action ${name}`);
  return action;
}

function run(name: string, args: unknown[], params: unknown = {}): unknown {
  return find(name).run(ctx, { args, params });
}

beforeEach(() => resetMockState());

describe("mock plugin", () => {
  it("exposes the mock namespace with every verb", () => {
    expect(mockPlugin.namespace).toBe("mock");
    const names = mockActions.map((action) => action.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "start",
        "stop",
        "intercept",
        "respond",
        "clock.freeze",
        "clock.advance",
        "flag",
        "reset",
      ]),
    );
  });
});

describe("mock intercept / respond", () => {
  it("registers an interceptor in state", () => {
    run("intercept", ["POST", "**/charge"], { respond: { status: 201, body: { id: "ch_1" } } });
    const state = getMockState();
    expect(state.intercepts).toHaveLength(1);
    expect(state.intercepts[0]).toMatchObject({ method: "POST", path: "**/charge" });
    expect(state.intercepts[0]?.respond).toEqual({ status: 201, body: { id: "ch_1" } });
  });

  it("builds a canned response", () => {
    expect(run("respond", [201], { body: { ok: true } })).toEqual({
      status: 201,
      body: { ok: true },
    });
  });
});

describe("mock flag", () => {
  it("defaults to true and is readable", () => {
    run("flag", ["new-checkout"]);
    expect(getMockState().flags.get("new-checkout")).toBe(true);
  });

  it("takes an explicit value from opts", () => {
    run("flag", ["rollout"], { value: 0.5 });
    expect(getMockState().flags.get("rollout")).toBe(0.5);
  });
});

describe("mock clock", () => {
  it("freezes at a parsed instant", () => {
    const instant = run("clock.freeze", ["2026-01-01T00:00:00Z"]);
    expect(instant).toBe(Date.parse("2026-01-01T00:00:00Z"));
    expect(getMockState().frozenInstant).toBe(instant);
  });

  it("advances the frozen instant by a duration", () => {
    run("clock.freeze", ["2026-01-01T00:00:00Z"]);
    const next = run("clock.advance", ["1h"]);
    expect(next).toBe(Date.parse("2026-01-01T01:00:00Z"));
    expect(getMockState().frozenInstant).toBe(next);
  });

  // `mock.clock.freeze 2026-01-01T00:00:00Z` and `mock.clock.advance 1h`, the
  // form the docs and examples use, hand the action a unit value, not a string.
  it("reads the language's own instant and duration literals", () => {
    const iso = "2026-01-01T00:00:00Z";
    const frozen = run("clock.freeze", [{ kind: "instant", epochMs: Date.parse(iso), iso }]);
    expect(frozen).toBe(Date.parse(iso));

    const next = run("clock.advance", [{ kind: "duration", ms: 3_600_000 }]);
    expect(next).toBe(Date.parse("2026-01-01T01:00:00Z"));
  });
});

describe("mock lifecycle", () => {
  it("start registers a named mock", () => {
    run("start", ["payments"], { from: "openapi.yaml" });
    expect(getMockState().mocks.get("payments")).toMatchObject({
      name: "payments",
      from: "openapi.yaml",
    });
  });

  it("stop clears mocks and intercepts but keeps flags", () => {
    run("flag", ["keep"]);
    run("start", ["payments"]);
    run("intercept", ["GET", "/health"]);
    run("stop", []);
    const state = getMockState();
    expect(state.mocks.size).toBe(0);
    expect(state.intercepts).toHaveLength(0);
    expect(state.flags.get("keep")).toBe(true);
  });

  it("reset clears all state", () => {
    run("start", ["payments"]);
    run("flag", ["x"]);
    run("intercept", ["GET", "/health"]);
    run("clock.freeze", [1000]);
    run("reset", []);
    const state = getMockState();
    expect(state.mocks.size).toBe(0);
    expect(state.flags.size).toBe(0);
    expect(state.intercepts).toHaveLength(0);
    expect(state.frozenInstant).toBeUndefined();
  });
});
