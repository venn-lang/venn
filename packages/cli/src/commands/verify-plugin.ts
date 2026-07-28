import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginDefinition } from "@venn-lang/sdk";

/**
 * `venn verify-plugin <path>`: import a plugin module, print what it declares,
 * and check its shape.
 *
 * @param args - `path` is the module to import, relative to the working
 * directory or absolute.
 * @returns 0 when the plugin names itself and a namespace, 1 when it does not.
 * @throws Error when the module exports nothing that looks like a plugin.
 */
export async function verifyPluginCommand(args: { path: string }): Promise<number> {
  const plugin = await loadPlugin(args.path);
  const out = process.stdout;
  out.write(`Plugin: ${plugin.name} (namespace "${plugin.namespace}")\n`);
  out.write(`  actions:   ${plugin.actions?.length ?? 0}\n`);
  out.write(`  matchers:  ${plugin.matchers?.length ?? 0}\n`);
  out.write(`  resources: ${plugin.resources?.length ?? 0}\n`);
  const ok = Boolean(plugin.name && plugin.namespace);
  out.write(ok ? "\n✓ plugin shape is valid\n" : "\n✗ plugin shape is invalid\n");
  return ok ? 0 : 1;
}

async function loadPlugin(path: string): Promise<PluginDefinition> {
  const mod = (await import(pathToFileURL(resolve(path)).href)) as Record<string, unknown>;
  const plugin = mod.default ?? Object.values(mod).find(isPlugin);
  if (!isPlugin(plugin)) throw new Error(`No plugin export found in ${path}`);
  return plugin;
}

function isPlugin(value: unknown): value is PluginDefinition {
  return typeof value === "object" && value !== null && "namespace" in value && "name" in value;
}
