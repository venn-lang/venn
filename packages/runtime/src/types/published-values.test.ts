import { definePlugin } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { publishedValueTypes } from "./published-values.js";

const WITH = definePlugin({
  name: "@t/kit",
  version: "0",
  namespace: "kit",
  values: [{ name: "rate", doc: "How fast.", type: t.number, value: 42 }],
});

const WITHOUT = definePlugin({ name: "@t/bare", version: "0", namespace: "bare" });

/**
 * What the checker asks a package for, when the package is a plugin rather than
 * something an install derived types from. Same shape either way.
 */
describe("what a plugin publishes as a value", () => {
  it("is keyed by the specifier an import writes", () => {
    const found = publishedValueTypes([WITH]);

    expect(found.get("@t/kit")).toEqual({ rate: { kind: "prim", name: "number" } });
  });

  it("leaves out a plugin that publishes none", () => {
    expect(publishedValueTypes([WITH, WITHOUT]).has("@t/bare")).toBe(false);
  });

  it("is empty when nothing publishes any", () => {
    expect(publishedValueTypes([WITHOUT]).size).toBe(0);
  });
});
