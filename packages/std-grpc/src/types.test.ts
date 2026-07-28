import { type FnSpec, type TypeSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { grpcPlugin } from "./plugin.js";
import { grpcTypeDefs } from "./types.js";

describe("grpc type defs", () => {
  it("gives every verb a signature", () => {
    const unsigned = (grpcPlugin.actions ?? []).filter((action) => !action.signature);
    expect(unsigned.map((action) => action.name)).toEqual([]);
  });

  it("only names types the plugin publishes", () => {
    // A ref nobody published does not fail: it quietly degrades to dynamic.
    // Read through the plugin, so an unwired `typeDefs` fails here too.
    expect(grpcPlugin.typeDefs).toBe(grpcTypeDefs);
    const published = Object.keys(grpcPlugin.typeDefs ?? {}).map((name) => `grpc.${name}`);
    expect(referenced().filter((name) => !published.includes(name))).toEqual([]);
  });

  it("takes the method positionally and says nothing about the message", () => {
    // The request message is the options map, and the response comes from a proto.
    expect(signatureOf("call")).toEqual(t.fn([t.string], t.dynamic));
    expect(signatureOf("stream")).toEqual(t.fn([t.string], t.list(t.dynamic)));
  });

  it("types reflection down to the method metadata", () => {
    expect(signatureOf("reflect")).toEqual(t.fn([t.string], t.list(t.ref("grpc.MethodInfo"))));
    const info = grpcTypeDefs.MethodInfo as { fields: Record<string, TypeSpec> };
    expect(Object.keys(info.fields)).toEqual([
      "name",
      "requestType",
      "responseType",
      "clientStreaming",
      "serverStreaming",
    ]);
  });
});

function signatureOf(name: string): FnSpec {
  const action = (grpcPlugin.actions ?? []).find((entry) => entry.name === name);
  if (!action?.signature) throw new Error(`grpc.${name} has no signature`);
  return action.signature;
}

/** Every name the signatures and the type defs point at, published or not. */
function referenced(): readonly string[] {
  const fromActions = (grpcPlugin.actions ?? []).flatMap((action) =>
    action.signature ? refsOf(action.signature) : [],
  );
  return [...fromActions, ...Object.values(grpcTypeDefs).flatMap(refsOf)];
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
