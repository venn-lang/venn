import { type FnSpec, type TypeSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { dbPlugin } from "../plugin.js";
import { dbTypeDefs } from "./type-defs.js";

describe("db type defs", () => {
  it("gives every verb a signature", () => {
    const unsigned = (dbPlugin.actions ?? []).filter((action) => !action.signature);
    expect(unsigned.map((action) => action.name)).toEqual([]);
  });

  it("only names types the plugin publishes", () => {
    // A ref nobody published does not fail: it quietly degrades to dynamic.
    // Read through the plugin, so an unwired `typeDefs` fails here too.
    expect(dbPlugin.typeDefs).toBe(dbTypeDefs);
    const published = Object.keys(dbPlugin.typeDefs ?? {}).map((name) => `db.${name}`);
    expect(referenced().filter((name) => !published.includes(name))).toEqual([]);
  });

  it("takes the SQL positionally and gives rows back", () => {
    // `where` is an option, so it is the Zod schema's business, not the signature's.
    expect(signatureOf("query")).toEqual(t.fn([t.string], t.list(t.ref("db.Row"))));
    expect(signatureOf("exec")).toEqual(t.fn([t.string], t.number));
  });

  it("hands the same tables between snapshot and restore", () => {
    expect(signatureOf("snapshot")).toEqual(t.fn([], t.ref("db.Tables")));
    expect(signatureOf("restore")).toEqual(t.fn([t.ref("db.Tables")], t.void));
  });
});

function signatureOf(name: string): FnSpec {
  const action = (dbPlugin.actions ?? []).find((entry) => entry.name === name);
  if (!action?.signature) throw new Error(`db.${name} has no signature`);
  return action.signature;
}

/** Every name the signatures and the type defs point at, published or not. */
function referenced(): readonly string[] {
  const fromActions = (dbPlugin.actions ?? []).flatMap((action) =>
    action.signature ? refsOf(action.signature) : [],
  );
  return [...fromActions, ...Object.values(dbTypeDefs).flatMap(refsOf)];
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
