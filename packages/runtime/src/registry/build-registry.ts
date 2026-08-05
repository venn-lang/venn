import {
  HOST_CODES,
  type HostCapability,
  missingCapabilities,
  VennError,
} from "@venn-lang/contracts";
import type { ActionDefinition, PluginDefinition, ValueDefinition } from "@venn-lang/sdk";
import type { Registry, ResolvedAction, ResolvedMatcher } from "./registry.types.js";

/**
 * Ingest plugins after negotiating each plugin's capabilities against the host.
 *
 * @param args.plugins The plugins to index, in load order; later ones win a clash.
 * @param args.caps The capabilities this host offers.
 * @returns A registry resolving actions, matchers and namespaces.
 * @throws VennError `VN2010` when a plugin requires a capability the host lacks.
 */
export function buildRegistry(args: {
  plugins: readonly PluginDefinition[];
  caps: readonly HostCapability[];
}): Registry {
  for (const plugin of args.plugins) assertPluginCaps({ plugin, caps: args.caps });
  return indexPlugins(args.plugins);
}

function assertPluginCaps(args: {
  plugin: PluginDefinition;
  caps: readonly HostCapability[];
}): void {
  const missing = missingCapabilities({ requires: args.plugin.requires ?? [], caps: args.caps });
  if (missing.length === 0) return;
  const list = missing.map((cap) => `"${cap}"`).join(", ");
  throw new VennError({
    code: HOST_CODES.VN2010_MISSING_CAPABILITY,
    message: `Plugin "${args.plugin.name}" requires capability ${list}, absent from this host.`,
    detail: { plugin: args.plugin.name, missing },
  });
}

/** The maps one pass over the plugins fills, and the registry then reads. */
interface Index {
  actions: Map<string, ResolvedAction>;
  matchers: Map<string, ResolvedMatcher>;
  /** Namespace to the package that contributes it, so an import can be named. */
  namespaces: Map<string, string>;
  packages: Map<string, string>;
  byPackage: Map<string, PluginDefinition>;
  values: { namespace: string; value: ValueDefinition }[];
}

function indexPlugins(plugins: readonly PluginDefinition[]): Registry {
  const index = blank();
  for (const plugin of plugins) addPlugin(plugin, index);
  return faceOf(index);
}

function blank(): Index {
  return {
    actions: new Map(),
    matchers: new Map(),
    namespaces: new Map(),
    packages: new Map(),
    byPackage: new Map(),
    values: [],
  };
}

function faceOf(index: Index): Registry {
  return {
    action: ({ namespace, name }) => index.actions.get(`${namespace}.${name}`),
    matcher: (name) => index.matchers.get(name),
    hasNamespace: (namespace) => index.namespaces.has(namespace),
    namespaceOf: (pkg) => index.packages.get(pkg),
    packageOf: (namespace) => index.namespaces.get(namespace),
    packages: () => [...index.byPackage.keys()],
    plugin: (pkg) => index.byPackage.get(pkg),
    actions: () => listActions(index.actions),
    values: () => index.values,
  };
}

function listActions(
  actions: Map<string, ResolvedAction>,
): { namespace: string; name: string; action: ActionDefinition }[] {
  return [...actions].map(([key, resolved]) => ({
    namespace: key.slice(0, key.indexOf(".")),
    name: key.slice(key.indexOf(".") + 1),
    action: resolved.action,
  }));
}

function addPlugin(plugin: PluginDefinition, index: Index): void {
  index.namespaces.set(plugin.namespace, plugin.name);
  index.packages.set(plugin.name, plugin.namespace);
  index.byPackage.set(plugin.name, plugin);
  for (const value of plugin.values ?? []) {
    index.values.push({ namespace: plugin.namespace, value });
  }
  for (const action of plugin.actions ?? []) {
    index.actions.set(`${plugin.namespace}.${action.name}`, { plugin, action });
  }
  for (const matcher of plugin.matchers ?? []) {
    index.matchers.set(matcher.name, { plugin, matcher });
  }
}
