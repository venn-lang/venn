import { type TypeSpec, t } from "@venn/types";
import { describe, expect, it } from "vitest";
import { mockActions } from "./actions/index.js";
import { mockPlugin } from "./plugin.js";
import { mockTypeDefs } from "./types.js";

/** Every named type a spec reaches for, however deep. */
function refsIn(spec: TypeSpec): readonly string[] {
  return spec.kind === "ref" ? [spec.name] : childrenOf(spec).flatMap(refsIn);
}

function childrenOf(spec: TypeSpec): readonly TypeSpec[] {
  if (spec.kind === "list") return [spec.element];
  if (spec.kind === "map") return [spec.value];
  if (spec.kind === "record") return Object.values(spec.fields);
  if (spec.kind === "fn") return [...spec.params, spec.result];
  return spec.kind === "union" ? [...spec.members] : [];
}

describe("mock signatures", () => {
  it("types every verb — a call with no signature stays dynamic", () => {
    const untyped = mockActions.filter((action) => !action.signature).map((a) => a.name);

    expect(untyped).toEqual([]);
  });

  // A ref nobody published degrades to dynamic without a word, which is exactly
  // the failure this catches.
  it("only refers to types it publishes", () => {
    const published = Object.keys(mockTypeDefs).map((name) => `mock.${name}`);
    const signatures = mockActions.flatMap((action) => action.signature ?? []);
    const refs = [...signatures, ...Object.values(mockTypeDefs)].flatMap(refsIn);

    for (const ref of refs) expect(published).toContain(ref);
  });

  it("hands `mock.start` back a Mock, from a single positional name", () => {
    const start = mockActions.find((action) => action.name === "start");

    expect(start?.signature).toEqual({
      kind: "fn",
      params: [{ kind: "prim", name: "string" }],
      result: { kind: "ref", name: "mock.Mock" },
    });
  });

  // `respond` is in the opts map, so it is the Zod schema's business, not the
  // signature's: two positional strings and nothing else.
  it("leaves the options map out of `mock.intercept`", () => {
    const intercept = mockActions.find((action) => action.name === "intercept");

    expect(intercept?.signature?.params).toHaveLength(2);
    expect(intercept?.signature?.result).toEqual({ kind: "ref", name: "mock.Interceptor" });
  });

  // The clock verbs are the only ones a flow calls with a unit literal, so they
  // are the only signatures that have to name `instant` and `duration`. Narrow
  // them back to string|number and the documented call stops type-checking.
  it("lets the clock verbs take the language's own literals", () => {
    const params = (name: string) =>
      mockActions.find((action) => action.name === name)?.signature?.params;

    expect(params("clock.freeze")).toEqual([
      { kind: "union", members: [t.string, t.number, t.instant] },
    ]);
    expect(params("clock.advance")).toEqual([
      { kind: "union", members: [t.string, t.number, t.duration] },
    ]);
  });

  it("publishes its named types under the mock namespace", () => {
    expect(mockPlugin.typeDefs).toBe(mockTypeDefs);
    expect(Object.keys(mockTypeDefs)).toEqual(["Mock", "Interceptor", "Response"]);
  });
});
