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

function indexPlugins(plugins: readonly PluginDefinition[]): Registry {
  const actions = new Map<string, ResolvedAction>();
  const matchers = new Map<string, ResolvedMatcher>();
  const namespaces = new Set<string>();
  const packages = new Map<string, string>();
  const byPackage = new Map<string, PluginDefinition>();
  const values: { namespace: string; value: ValueDefinition }[] = [];
  for (const plugin of plugins) {
    for (const value of plugin.values ?? []) values.push({ namespace: plugin.namespace, value });
    addPlugin({ plugin, actions, matchers, namespaces, packages });
    byPackage.set(plugin.name, plugin);
  }
  return {
    action: ({ namespace, name }) => actions.get(`${namespace}.${name}`),
    matcher: (name) => matchers.get(name),
    hasNamespace: (namespace) => namespaces.has(namespace),
    namespaceOf: (pkg) => packages.get(pkg),
    plugin: (pkg) => byPackage.get(pkg),
    actions: () => listActions(actions),
    values: () => values,
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

function addPlugin(args: {
  plugin: PluginDefinition;
  actions: Map<string, ResolvedAction>;
  matchers: Map<string, ResolvedMatcher>;
  namespaces: Set<string>;
  packages: Map<string, string>;
}): void {
  const { plugin, actions, matchers, namespaces, packages } = args;
  namespaces.add(plugin.namespace);
  packages.set(plugin.name, plugin.namespace);
  for (const action of plugin.actions ?? []) {
    actions.set(`${plugin.namespace}.${action.name}`, { plugin, action });
  }
  for (const matcher of plugin.matchers ?? []) {
    matchers.set(matcher.name, { plugin, matcher });
  }
}
