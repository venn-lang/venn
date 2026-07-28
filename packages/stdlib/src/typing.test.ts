import type { PluginDefinition } from "@venn/sdk";
import type { TypeSpec } from "@venn/types";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";

/**
 * The stdlib's typing, held to its word.
 *
 * A signature is a promise made to every editor and every checker downstream. A
 * verb that quietly stops making it, or a type reference that points at nothing,
 * degrades to `dynamic` in silence: the user sees no error, only an editor that
 * has forgotten what it knew. Nothing else in the suite would notice, so this
 * walks every plugin and refuses to let that happen.
 */

/** `http.Request`: the name a flow writes, for everything the stdlib publishes. */
function publishedNames(plugins: readonly PluginDefinition[]): Set<string> {
  const names = new Set<string>();
  for (const plugin of plugins) {
    for (const name of Object.keys(plugin.typeDefs ?? {})) names.add(`${plugin.namespace}.${name}`);
  }
  return names;
}

/** Every `ref` anywhere inside a spec, however deeply nested. */
function refsIn(spec: TypeSpec): string[] {
  switch (spec.kind) {
    case "ref":
      return [spec.name];
    case "list":
      return refsIn(spec.element);
    case "map":
      return refsIn(spec.value);
    case "union":
      return spec.members.flatMap(refsIn);
    case "fn":
      return [...spec.params.flatMap(refsIn), ...refsIn(spec.result)];
    case "record":
      return Object.values(spec.fields).flatMap(refsIn);
    default:
      return [];
  }
}

/** Every spec the stdlib ships, labelled by where it came from. */
function allSpecs(): { where: string; spec: TypeSpec }[] {
  const out: { where: string; spec: TypeSpec }[] = [];
  for (const plugin of allPlugins) {
    for (const [name, spec] of Object.entries(plugin.typeDefs ?? {})) {
      out.push({ where: `${plugin.namespace}.${name}`, spec });
    }
    for (const action of plugin.actions ?? []) {
      if (action.signature)
        out.push({ where: `${plugin.namespace}.${action.name}`, spec: action.signature });
    }
  }
  return out;
}

describe("the stdlib is typed", () => {
  it("gives every verb a signature", () => {
    const unsigned = allPlugins.flatMap((plugin) =>
      (plugin.actions ?? [])
        .filter((action) => !action.signature)
        .map((action) => `${plugin.namespace}.${action.name}`),
    );

    expect(unsigned).toEqual([]);
  });

  // A ref nobody publishes is not an error anywhere, it just quietly becomes
  // `dynamic`, which is exactly the silence this test exists to break.
  it("points every type reference at something published", () => {
    const published = publishedNames(allPlugins);
    const dangling = allSpecs().flatMap(({ where, spec }) =>
      refsIn(spec)
        .filter((ref) => !published.has(ref))
        .map((ref) => `${where} -> ${ref}`),
    );

    expect(dangling).toEqual([]);
  });

  it("publishes each name once, so a flow's `http.Request` is unambiguous", () => {
    const names = allPlugins.flatMap((plugin) =>
      Object.keys(plugin.typeDefs ?? {}).map((name) => `${plugin.namespace}.${name}`),
    );

    expect(names.length).toBe(new Set(names).size);
  });

  /** Every verb is reachable as `namespace.verb`; a nameless one is unreachable. */
  it("names every verb and namespace it contributes", () => {
    for (const plugin of allPlugins) {
      expect(plugin.namespace, plugin.name).toBeTruthy();
      for (const action of plugin.actions ?? []) expect(action.name, plugin.name).toBeTruthy();
    }
  });
});
