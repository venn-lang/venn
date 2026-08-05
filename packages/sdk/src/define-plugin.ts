import type { PluginDefinition } from "./types/plugin.types.js";

/**
 * Define a plugin: a namespace plus the actions, matchers, values, decorators
 * and named types it contributes.
 *
 * @param def The whole contribution, including the host capabilities it requires.
 * @returns The same definition, typed. Checking and loading it is the runtime's job.
 */
export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
