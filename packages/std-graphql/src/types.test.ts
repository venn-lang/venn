import { type FnSpec, type TypeSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { gqlPlugin } from "./plugin.js";
import { gqlTypeDefs } from "./types.js";

describe("gql type defs", () => {
  it("gives every verb a signature", () => {
    const unsigned = (gqlPlugin.actions ?? []).filter((action) => !action.signature);
    expect(unsigned.map((action) => action.name)).toEqual([]);
  });

  it("only names types the plugin publishes", () => {
    // A ref nobody published does not fail: it quietly degrades to dynamic.
    // Read through the plugin, so an unwired `typeDefs` fails here too.
    expect(gqlPlugin.typeDefs).toBe(gqlTypeDefs);
    const published = Object.keys(gqlPlugin.typeDefs ?? {}).map((name) => `gql.${name}`);
    expect(referenced().filter((name) => !published.includes(name))).toEqual([]);
  });

  it("takes the document positionally and answers with the envelope", () => {
    // `variables` and `auth` are options, so no parameter stands for them.
    const expected = t.fn([t.string], t.ref("gql.GraphqlResponse"));
    for (const name of ["query", "mutate", "subscribe"]) {
      expect(signatureOf(name)).toEqual(expected);
    }
  });

  it("gives the envelope an errors list of published errors", () => {
    const envelope = gqlTypeDefs.GraphqlResponse as { fields: Record<string, TypeSpec> };
    expect(envelope.fields.errors).toEqual(t.list(t.ref("gql.GraphqlError")));
  });
});

function signatureOf(name: string): FnSpec {
  const action = (gqlPlugin.actions ?? []).find((entry) => entry.name === name);
  if (!action?.signature) throw new Error(`gql.${name} has no signature`);
  return action.signature;
}

/** Every name the signatures and the type defs point at, published or not. */
function referenced(): readonly string[] {
  const fromActions = (gqlPlugin.actions ?? []).flatMap((action) =>
    action.signature ? refsOf(action.signature) : [],
  );
  return [...fromActions, ...Object.values(gqlTypeDefs).flatMap(refsOf)];
}

function refsOf(spec: TypeSpec): readonly string[] {
  if (spec.kind === "ref") return [spec.name];
  if (spec.kind === "list") return refsOf(spec.element);
  if (spec.kind === "map") return refsOf(spec.value);
  return refsOfCompound(spec);
}

function refsOfCompound(spec: TypeSpec): readonly string[] {
  if (spec.kind === "record") return Object.values(spec.fields).flatMap(refsOf);
  if (spec.kind === "fn") return [...spec.params, spec.result].flatMap(refsOf);
  if (spec.kind === "union") return spec.members.flatMap(refsOf);
  return [];
}
