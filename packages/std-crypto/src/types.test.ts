import { type FnSpec, type TypeSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { cryptoActions } from "./actions/index.js";
import { cryptoTypeDefs } from "./types.js";

function signatureOf(name: string): FnSpec {
  const found = cryptoActions.find((candidate) => candidate.name === name);
  if (!found?.signature) throw new Error(`no signature for ${name}`);
  return found.signature;
}

/** Every `ref` reachable from a spec, arguments and nesting included. */
function refsIn(spec: TypeSpec): string[] {
  if (spec.kind === "ref") return [spec.name];
  if (spec.kind === "list") return refsIn(spec.element);
  if (spec.kind === "map") return refsIn(spec.value);
  if (spec.kind === "union") return spec.members.flatMap(refsIn);
  if (spec.kind === "record") return Object.values(spec.fields).flatMap(refsIn);
  if (spec.kind === "fn") return [...spec.params, spec.result].flatMap(refsIn);
  return [];
}

/** Every name this plugin refers to, from its signatures and its own types. */
function referencedNames(): string[] {
  const fromActions = cryptoActions.flatMap((action) =>
    action.signature ? refsIn(action.signature) : [],
  );
  return [...fromActions, ...Object.values(cryptoTypeDefs).flatMap(refsIn)];
}

describe("crypto types", () => {
  it("gives every verb a signature", () => {
    const untyped = cryptoActions.filter((action) => !action.signature);

    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  // One declaration, read by both: the editor renders the type the checker uses.
  // A verb that answers one and not the other reads as untyped in the editor.
  it("names what every verb gives back", () => {
    const unnamed = cryptoActions.filter((action) => !action.signature?.result);

    expect(unnamed.map((action) => action.name)).toEqual([]);
  });

  // The trailing options map is the Zod schema's business. A verb whose only
  // inputs are options takes nothing in argument position, and must say so.
  it("counts only positional arguments", () => {
    expect(signatureOf("hash").params).toEqual([t.string]);
    expect(signatureOf("jwt.sign").params).toEqual([]);
    expect(signatureOf("uuid").params).toEqual([]);
  });

  it("points `jwt.decode` at the shape it takes a token apart into", () => {
    expect(signatureOf("jwt.decode").result).toEqual(t.ref("crypto.Jwt"));
    expect(cryptoTypeDefs.Jwt).toEqual(
      t.record({
        header: t.map(t.dynamic),
        payload: t.map(t.dynamic),
        signature: t.string,
        signingInput: t.string,
      }),
    );
  });

  /**
   * A `ref` nothing publishes degrades to dynamic without saying a word, and so
   * does a `ref` written short: the catalog keys on the qualified name, so
   * `ref("Jwt")` resolves to nothing while looking right at a glance.
   */
  it("publishes every name it refers to, qualified", () => {
    const published = Object.keys(cryptoTypeDefs).map((name) => `crypto.${name}`);
    const referenced = referencedNames();

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) expect(published).toContain(name);
  });
});
