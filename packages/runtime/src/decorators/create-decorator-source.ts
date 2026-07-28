import type { DecoratorDefinition, DecoratorSource } from "@venn/core";
import type { PluginDefinition } from "@venn/sdk";
import { builtinDecorators } from "./builtin-decorators.js";

/**
 * Every decorator this run understands: the ones the language ships with, plus
 * whatever the loaded plugins contribute.
 *
 * A plugin's decorator overrides a built-in of the same name on purpose. The
 * built-ins are a stdlib, not a reserved word list, and a project that wants its
 * own `@retry` is entitled to it.
 *
 * @param plugins The plugins loaded for this run, in load order.
 * @returns A source that looks a decorator up by name.
 */
export function createDecoratorSource(plugins: readonly PluginDefinition[]): DecoratorSource {
  const byName = new Map<string, DecoratorDefinition>();
  for (const decorator of builtinDecorators) byName.set(decorator.name, decorator);
  for (const plugin of plugins) {
    for (const decorator of plugin.decorators ?? []) {
      byName.set(decorator.name, decorator as DecoratorDefinition);
    }
  }
  return { get: (name) => byName.get(name) };
}
