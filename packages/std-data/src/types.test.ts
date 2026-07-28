import { type TypeSpec, t } from "@venn-lang/types";
import { describe, expect, it } from "vitest";
import { dataActions } from "./actions/index.js";
import { allFakerSpecs } from "./faker/index.js";
import { dataPlugin } from "./plugin.js";
import { dataTypeDefs } from "./types.js";

function signatureOf(name: string): TypeSpec | undefined {
  return dataActions.find((action) => action.name === name)?.signature;
}

/** What a verb's signature promises back, as the checker will read it. */
function resultOf(name: string): TypeSpec | undefined {
  const signature = signatureOf(name);
  return signature?.kind === "fn" ? signature.result : undefined;
}

/** Every name a spec points at, however deep it is buried. */
function refsIn(spec: TypeSpec): string[] {
  if (spec.kind === "ref") return [spec.name];
  if (spec.kind === "list") return refsIn(spec.element);
  if (spec.kind === "map") return refsIn(spec.value);
  if (spec.kind === "record") return Object.values(spec.fields).flatMap(refsIn);
  if (spec.kind === "fn") return [...spec.params, spec.result].flatMap(refsIn);
  if (spec.kind === "union") return spec.members.flatMap(refsIn);
  return [];
}

describe("data signatures", () => {
  it("types every verb", () => {
    const untyped = dataActions.filter((action) => !action.signature);
    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("publishes its named types under the namespace", () => {
    expect(dataPlugin.typeDefs).toBe(dataTypeDefs);
    expect(dataTypeDefs.Row).toEqual(t.map(t.string));
  });

  // A ref that resolves to nothing degrades to dynamic in silence, which is the
  // one failure mode nobody notices until a hover reads `dynamic`.
  it("only refers to types it publishes", () => {
    const published = Object.keys(dataTypeDefs).map((name) => `data.${name}`);
    const used = dataActions.flatMap((action) =>
      action.signature ? refsIn(action.signature) : [],
    );
    expect([...new Set(used)].filter((ref) => !published.includes(ref))).toEqual([]);
  });
});

describe("data faker signatures", () => {
  it("reads no arguments where the spec draws freely", () => {
    expect(signatureOf("faker.email")).toEqual(t.fn([], t.string));
    expect(signatureOf("faker.boolean")).toEqual(t.fn([], t.bool));
  });

  it("carries the bounds a spec reads positionally", () => {
    expect(signatureOf("faker.int")).toEqual(t.fn([t.number, t.number], t.number));
    expect(signatureOf("faker.nanoid")).toEqual(t.fn([t.number], t.string));
  });

  // A spec says what it draws as a type, not as a word looked up in a table:
  // there is no spelling of it that can miss and quietly become `dynamic`.
  it("promises exactly what each spec declares", () => {
    const promised = allFakerSpecs.map((spec) => [spec.name, resultOf(`faker.${spec.name}`)]);
    const declared = allFakerSpecs.map((spec) => [spec.name, spec.result]);
    expect(promised).toEqual(declared);
  });
});

describe("data parse signatures", () => {
  it("gives csv rows back as the published Row type", () => {
    expect(signatureOf("csv")).toEqual(t.fn([t.string], t.list(t.ref("data.Row"))));
  });

  it("leaves parsed JSON dynamic", () => {
    expect(signatureOf("json")).toEqual(t.fn([t.string], t.dynamic));
  });
});
