import type { TypeSpec } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { wsActions } from "./actions/index.js";
import { wsPlugin } from "./plugin.js";
import { wsTypeDefs } from "./types/index.js";

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

describe("ws signatures", () => {
  it("types every verb — a call with no signature stays dynamic", () => {
    const untyped = wsActions.filter((action) => !action.signature).map((a) => a.name);

    expect(untyped).toEqual([]);
  });

  // A ref nobody published degrades to dynamic without a word, which is exactly
  // the failure this catches.
  it("only refers to types it publishes", () => {
    const published = Object.keys(wsTypeDefs).map((name) => `ws.${name}`);
    const signatures = wsActions.flatMap((action) => action.signature ?? []);
    const refs = [...signatures, ...Object.values(wsTypeDefs)].flatMap(refsIn);

    for (const ref of refs) expect(published).toContain(ref);
  });

  // `ws.expect { type: "ack" }` is all opts, so the signature takes nothing and
  // exists for its result: that is what types `res` for the `type` matcher.
  it("hands `ws.expect` back a Message from no positional argument", () => {
    const expected = wsActions.find((action) => action.name === "expect");

    expect(expected?.signature).toEqual({
      kind: "fn",
      params: [],
      result: { kind: "ref", name: "ws.Message" },
    });
  });

  it("gives `ws.connect` the URL and nothing else", () => {
    const connect = wsActions.find((action) => action.name === "connect");

    expect(connect?.signature?.params).toEqual([{ kind: "prim", name: "string" }]);
    expect(connect?.signature?.result).toEqual({ kind: "prim", name: "void" });
  });

  it("publishes Message as the checker's type as well as the runtime's", () => {
    expect(wsPlugin.typeDefs).toBe(wsTypeDefs);
    expect(Object.keys(wsTypeDefs)).toEqual(["Message"]);
    expect(wsPlugin.types?.Message).toBeDefined();
  });
});
