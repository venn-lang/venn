import { describe, expect, it } from "vitest";
import { envPlugin } from "./plugin.js";

describe("venn/env", () => {
  it("contributes the `env` namespace and nothing else", () => {
    expect(envPlugin.namespace).toBe("env");
    expect(envPlugin.name).toBe("venn/env");
  });

  it("has no verbs, `env.NAME` is a read, not a call", () => {
    expect(envPlugin.actions ?? []).toEqual([]);
    expect(envPlugin.matchers ?? []).toEqual([]);
  });

  // Nothing to sign and nothing to name: the values are the strings `venn.toml`
  // declares, and `checkEnv`, not a type, is what catches `env.TPYO`.
  it("publishes no types either", () => {
    expect(envPlugin.typeDefs).toBeUndefined();
    expect(envPlugin.types).toBeUndefined();
  });
});
