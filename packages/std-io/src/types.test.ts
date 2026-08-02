import { type FnSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { ioPlugin } from "./plugin.js";

/** Every verb the plugin publishes, which is where a name is looked up. */
const actions = ioPlugin.actions ?? [];

function signatureOf(name: string): FnSpec {
  const found = actions.find((candidate) => candidate.name === name);
  if (!found?.signature) throw new Error(`io.${name} has no signature`);
  return found.signature;
}

function returnsOf(name: string): unknown {
  return actions.find((candidate) => candidate.name === name)?.signature?.result;
}

describe("io signatures", () => {
  it("types every verb, a namespace types all of itself or none of it", () => {
    const untyped = actions.filter((action) => !action.signature);

    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("says readLine may answer with nothing", () => {
    const signature = signatureOf("readLine");

    expect(signature.params).toEqual([]);
    expect(signature.result).toEqual({
      kind: "union",
      members: [
        { kind: "prim", name: "string" },
        { kind: "prim", name: "null" },
      ],
    });
  });

  it("gives args a list of strings, not a bare list", () => {
    expect(signatureOf("args").result).toEqual({
      kind: "list",
      element: { kind: "prim", name: "string" },
    });
  });

  // The hover line is read before the type is. It must not promise less.
  it("says in the hover line what the signature says in structure", () => {
    expect(returnsOf("readLine")).toEqual(t.union(t.string, t.null));
    expect(returnsOf("args")).toEqual(t.list(t.string));
  });

  // The printers take whatever they are handed and answer with nothing.
  it("leaves the printers open at the argument and empty at the result", () => {
    for (const name of ["print", "write", "eprint"]) {
      expect(signatureOf(name).params).toEqual([{ kind: "dynamic" }]);
      expect(signatureOf(name).result).toEqual({ kind: "prim", name: "void" });
    }
  });

  // io publishes no named type: it moves strings, and `string` is already named.
  it("publishes no types of its own", () => {
    expect(ioPlugin.typeDefs).toBeUndefined();
  });
});
