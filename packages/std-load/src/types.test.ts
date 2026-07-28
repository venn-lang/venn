import type { FnSpec, TypeSpec } from "@venn/types";
import { describe, expect, it } from "vitest";
import { loadActions } from "./actions/index.js";
import { loadPlugin } from "./plugin.js";
import { loadTypeDefs } from "./types.js";

function signatureOf(name: string): FnSpec {
  const found = loadActions.find((candidate) => candidate.name === name);
  if (!found?.signature) throw new Error(`load.${name} has no signature`);
  return found.signature;
}

/** Every name a spec points at, however deep. A ref nobody publishes is dynamic. */
function refsIn(spec: TypeSpec): string[] {
  if (spec.kind === "ref") return [spec.name];
  if (spec.kind === "list") return refsIn(spec.element);
  if (spec.kind === "map") return refsIn(spec.value);
  if (spec.kind === "union") return spec.members.flatMap(refsIn);
  if (spec.kind === "record") return Object.values(spec.fields).flatMap(refsIn);
  if (spec.kind === "fn") return [...spec.params.flatMap(refsIn), ...refsIn(spec.result)];
  return [];
}

describe("load signatures", () => {
  it("types every verb — a namespace types all of itself or none of it", () => {
    const untyped = loadActions.filter((action) => !action.signature);

    expect(untyped.map((action) => action.name)).toEqual([]);
  });

  it("takes a ramp's two VU counts positionally and hands back a ramp", () => {
    const signature = signatureOf("ramp");

    expect(signature.params).toEqual([
      { kind: "prim", name: "number" },
      { kind: "prim", name: "number" },
    ]);
    expect(signature.result).toEqual({ kind: "ref", name: "load.Ramp" });
  });

  // `over` and `hold` are options, described by the Zod params and nowhere else.
  it("keeps the options map out of the positional parameters", () => {
    expect(signatureOf("constant").params).toEqual([{ kind: "prim", name: "number" }]);
    expect(signatureOf("spike").params).toEqual([{ kind: "prim", name: "number" }]);
  });

  it("turns any profile into metrics", () => {
    const signature = signatureOf("run");

    expect(signature.params).toEqual([{ kind: "ref", name: "load.Profile" }]);
    expect(signature.result).toEqual({ kind: "ref", name: "load.Metrics" });
  });
});

describe("load typeDefs", () => {
  it("is what the plugin publishes", () => {
    expect(loadPlugin.typeDefs).toBe(loadTypeDefs);
  });

  // A ref that resolves to nothing degrades to dynamic in silence, so it is
  // checked here, where the silence is still cheap.
  it("resolves every ref it writes, from a signature or from another type", () => {
    const published = new Set(Object.keys(loadTypeDefs).map((name) => `load.${name}`));
    const written = [
      ...loadActions.map((action) => action.signature),
      ...Object.values(loadTypeDefs),
    ];

    for (const spec of written) {
      if (spec) for (const ref of refsIn(spec)) expect(published).toContain(ref);
    }
  });

  // The hover reads `load.ramp -> Ramp`. A word nobody publishes sends the
  // reader looking for a type that is not in the catalog and cannot be written.
  it("names in the hover line only types it actually publishes", () => {
    const published = new Set(Object.keys(loadTypeDefs));

    for (const action of loadActions) {
      const result = action.signature?.result;
      if (result?.kind === "ref") expect(published).toContain(result.name.split(".").pop());
    }
  });

  it("keeps the three profiles reachable through the union `load.run` takes", () => {
    expect(loadTypeDefs.Profile).toEqual({
      kind: "union",
      members: [
        { kind: "ref", name: "load.Ramp" },
        { kind: "ref", name: "load.Constant" },
        { kind: "ref", name: "load.Spike" },
      ],
    });
  });

  it("mirrors LoadMetrics field for field", () => {
    const metrics = loadTypeDefs.Metrics;

    expect(metrics?.kind === "record" && Object.keys(metrics.fields)).toEqual([
      "vus",
      "rps",
      "p50",
      "p95",
      "p99",
      "errorRate",
    ]);
  });
});
