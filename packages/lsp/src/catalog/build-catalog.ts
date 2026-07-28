import type { PluginDefinition } from "@venn/sdk";
import type { ActionEntry, MatcherEntry, SymbolCatalog, TypeEntry } from "./catalog.types.js";

interface Index {
  actions: Map<string, ActionEntry>;
  matchers: Map<string, MatcherEntry>;
  byNamespace: Map<string, ActionEntry[]>;
  typesByNamespace: Map<string, TypeEntry[]>;
  packages: Map<string, string>;
}

/**
 * Index the loaded plugins so completion, hover and tokens can look symbols up.
 *
 * @param plugins The plugin definitions loaded for the workspace.
 * @returns A read-only view over their actions, matchers and published types.
 */
export function buildCatalog(plugins: readonly PluginDefinition[]): SymbolCatalog {
  const index: Index = {
    actions: new Map(),
    matchers: new Map(),
    byNamespace: new Map(),
    typesByNamespace: new Map(),
    packages: new Map(),
  };
  for (const plugin of plugins) addPlugin(plugin, index);
  return view(index, plugins);
}

function view(index: Index, plugins: readonly PluginDefinition[]): SymbolCatalog {
  return {
    namespaces: () => [...index.byNamespace.keys()],
    packages: () => plugins.map((plugin) => plugin.name),
    hasNamespace: (namespace) => index.byNamespace.has(namespace),
    actionsIn: (namespace) => index.byNamespace.get(namespace) ?? [],
    action: (namespace, name) => index.actions.get(`${namespace}.${name}`),
    typesIn: (namespace) => index.typesByNamespace.get(namespace) ?? [],
    matchers: () => [...index.matchers.values()],
    matcher: (name) => index.matchers.get(name),
    namespaceOfPackage: (pkg) => index.packages.get(pkg),
    packagesFor: (namespace) =>
      [...index.packages.entries()]
        .filter(([, contributed]) => contributed === namespace)
        .map(([pkg]) => pkg),
  };
}

function addPlugin(plugin: PluginDefinition, index: Index): void {
  index.packages.set(plugin.name, plugin.namespace);
  const list = index.byNamespace.get(plugin.namespace) ?? [];
  index.byNamespace.set(plugin.namespace, list);
  for (const action of plugin.actions ?? []) {
    const entry = { namespace: plugin.namespace, name: action.name, package: plugin.name, action };
    index.actions.set(`${plugin.namespace}.${action.name}`, entry);
    list.push(entry);
  }
  for (const matcher of plugin.matchers ?? []) {
    index.matchers.set(matcher.name, { name: matcher.name, package: plugin.name, matcher });
  }
  addTypes(plugin, index);
}

/** A namespace offers its published types alongside its verbs: `http.Request`. */
function addTypes(plugin: PluginDefinition, index: Index): void {
  const entries = Object.entries(plugin.typeDefs ?? {});
  if (entries.length === 0) return;
  const list = index.typesByNamespace.get(plugin.namespace) ?? [];
  for (const [name, spec] of entries) {
    list.push({ namespace: plugin.namespace, name, package: plugin.name, spec });
  }
  index.typesByNamespace.set(plugin.namespace, list);
}
