import type { PluginDefinition } from "@venn-lang/sdk";
import type { TypeSpec } from "@venn-lang/types";

/**
 * What each plugin publishes as a value, keyed by the specifier an import writes.
 *
 * The checker types an imported name by asking what its package publishes, and a
 * package that is a plugin publishes here rather than in a `.d.ts` on disk. Same
 * shape either way, so nothing downstream has to know which it was.
 *
 * @param plugins The plugins loaded for this run.
 * @returns Package specifier to the values it publishes, by name.
 */
export function publishedValueTypes(
  plugins: readonly PluginDefinition[],
): Map<string, Record<string, TypeSpec>> {
  const found = new Map<string, Record<string, TypeSpec>>();
  for (const plugin of plugins) {
    const values = plugin.values ?? [];
    if (values.length === 0) continue;
    found.set(plugin.name, Object.fromEntries(values.map((one) => [one.name, one.type])));
  }
  return found;
}
