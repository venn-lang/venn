import { type FnSpec, type TypeSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { authActions } from "./actions/index.js";
import { authTypeDefs } from "./types/index.js";

function signatureOf(name: string): FnSpec {
  const found = authActions.find((candidate) => candidate.name === name);
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
  const fromActions = authActions.flatMap((action) =>
    action.signature ? refsIn(action.signature) : [],
  );
  return [...fromActions, ...Object.values(authTypeDefs).flatMap(refsIn)];
}

describe("auth types", () => {
  it("gives every verb a signature", () => {
    const untyped = authActions.filter((action) => !action.signature);

    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  // One declaration, read by both: the editor renders the type the checker uses.
  // A verb that answers one and not the other reads as untyped in the editor.
  it("names what every verb gives back", () => {
    const unnamed = authActions.filter((action) => !action.signature?.result);

    expect(unnamed.map((action) => action.name)).toEqual([]);
  });

  // The trailing options map is the Zod schema's business. `auth.jwt` takes
  // everything as options, so its argument list is empty and says so.
  it("counts only positional arguments", () => {
    expect(signatureOf("basic").params).toEqual([t.string, t.string]);
    expect(signatureOf("apikey").params).toEqual([t.string]);
    expect(signatureOf("jwt").params).toEqual([]);
  });

  it("gives the header builders one shape between them", () => {
    for (const name of ["bearer", "basic", "apikey"]) {
      expect(signatureOf(name).result).toEqual(t.ref("auth.Headers"));
    }
    expect(authTypeDefs.Headers).toEqual(t.map(t.string));
  });

  it("hands `auth.oauth2` back the token shape the port returns", () => {
    expect(signatureOf("oauth2").result).toEqual(t.ref("auth.Token"));
    expect(authTypeDefs.Token).toEqual(
      t.record({ access_token: t.string, token_type: t.string, expires_in: t.number }),
    );
  });

  /**
   * A `ref` nothing publishes degrades to dynamic without saying a word, and so
   * does a `ref` written short: the catalog keys on the qualified name, so
   * `ref("Token")` resolves to nothing while looking right at a glance.
   */
  it("publishes every name it refers to, qualified", () => {
    const published = Object.keys(authTypeDefs).map((name) => `auth.${name}`);
    const referenced = referencedNames();

    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) expect(published).toContain(name);
  });
});
