import type { ActionContext, ActionInput } from "@venn/sdk";
import { describe, expect, it } from "vitest";
import { constantAction } from "./constant.js";
import { rampAction } from "./ramp.js";
import { spikeAction } from "./spike.js";

const ctx = {} as ActionContext;

function input(args: readonly unknown[], params: unknown = {}): ActionInput<unknown> {
  return { args, params };
}

describe("load profile actions", () => {
  it("ramp builds a ramp profile from two positional VUs", () => {
    const profile = rampAction.run(ctx, input([0, 200], { over: 30000, hold: 60000 }));
    expect(profile).toMatchObject({ kind: "ramp", from: 0, to: 200, over: 30000, hold: 60000 });
  });

  it("constant builds a constant profile", () => {
    expect(constantAction.run(ctx, input([50], { over: 10000 }))).toMatchObject({
      kind: "constant",
      vus: 50,
      over: 10000,
    });
  });

  it("spike builds a spike profile", () => {
    expect(spikeAction.run(ctx, input([500], { at: 5000 }))).toMatchObject({
      kind: "spike",
      peak: 500,
      at: 5000,
    });
  });
});
