import type { ActionDefinition, MatcherDefinition, PluginDefinition } from "@venn-lang/sdk";

/** An action together with the plugin that owns it. */
export interface ResolvedAction {
  plugin: PluginDefinition;
  action: ActionDefinition;
}

/** A matcher together with the plugin that owns it. */
export interface ResolvedMatcher {
  plugin: PluginDefinition;
  matcher: MatcherDefinition;
}

/** Resolves `namespace.action`, matchers, and namespaces from ingested plugins. */
export interface Registry {
  action(args: { namespace: string; name: string }): ResolvedAction | undefined;
  matcher(name: string): ResolvedMatcher | undefined;
  hasNamespace(namespace: string): boolean;
  /** The namespace a package contributes, which is what an import of it brings. */
  namespaceOf(pkg: string): string | undefined;
  /** What a package publishes, for reading an import of it name by name. */
  plugin(pkg: string): PluginDefinition | undefined;
  /** Every action, for binding namespaces as values in the evaluator scope. */
  actions(): readonly { namespace: string; name: string; action: ActionDefinition }[];
}
