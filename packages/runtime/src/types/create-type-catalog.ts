import { type FnType, prune, specToType, type Type, type TypeCatalog } from "@venn-lang/core";
import type { PluginDefinition } from "@venn-lang/sdk";
import type { TypeSpec } from "@venn-lang/types";

/** The published specs, indexed by the name a flow would write. */
interface Published {
  types: Map<string, TypeSpec>;
  signatures: Map<string, TypeSpec>;
}

/**
 * Turn what the loaded plugins publish into what the checker can ask.
 *
 * This is the seam the core deliberately does not cross: `@venn-lang/core` knows
 * nothing about plugins and gets told. Names are qualified here, once: a plugin
 * says `Request` and a flow writes `http.Request`.
 *
 * @param plugins The plugins loaded for this run.
 * @returns A catalog answering a type name or an action's signature.
 */
export function createTypeCatalog(plugins: readonly PluginDefinition[]): TypeCatalog {
  const published: Published = { types: new Map(), signatures: new Map() };
  for (const plugin of plugins) collect(plugin, published);
  const reader = createReader(published);
  return {
    typeOf: (name) => reader.read(published.types, name),
    signatureOf: (target) => asFn(reader.read(published.signatures, target)),
  };
}

function collect(plugin: PluginDefinition, into: Published): void {
  for (const [name, spec] of Object.entries(plugin.typeDefs ?? {})) {
    into.types.set(`${plugin.namespace}.${name}`, spec);
  }
  for (const action of plugin.actions ?? []) {
    const key = `${plugin.namespace}.${action.name}`;
    if (action.signature) into.signatures.set(key, action.signature);
  }
}

/**
 * Read a published spec once and keep the result.
 *
 * The same `http.Request` has to be the same object every time it is asked for:
 * inference writes into what it is handed, and two copies would drift apart in
 * the middle of a file. `open` guards a type that refers to itself, so the
 * second visit answers "unknown" rather than recurring forever.
 */
function createReader(published: Published) {
  const cache = new Map<string, Type>();
  const open = new Set<string>();
  const read = (from: Map<string, TypeSpec>, name: string): Type | undefined => {
    const cached = cache.get(name);
    if (cached) return cached;
    const spec = from.get(name);
    if (!spec || open.has(name)) return undefined;
    open.add(name);
    const type = specToType(spec, (ref) => read(published.types, ref));
    open.delete(name);
    cache.set(name, type);
    return type;
  };
  return { read };
}

function asFn(type: Type | undefined): FnType | undefined {
  if (!type) return undefined;
  const pruned = prune(type);
  return pruned.kind === "fn" ? pruned : undefined;
}
