import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ALL_CAPABILITIES } from "@venn-lang/contracts";
import type { PluginDefinition } from "@venn-lang/sdk";

/**
 * `venn verify-plugin <path>`: import a plugin module, print what it declares,
 * and check its shape.
 *
 * @param args - `path` is the module to import, relative to the working
 * directory or absolute.
 * @returns 0 when nothing is wrong with the shape, 1 when something is, having
 * printed a line per fault.
 * @throws Error when the module exports nothing that looks like a plugin.
 */
export async function verifyPluginCommand(args: { path: string }): Promise<number> {
  const plugin = await loadPlugin(args.path);
  const out = process.stdout;
  out.write(`Plugin: ${plugin.name} (namespace "${plugin.namespace}")\n`);
  out.write(`  actions:   ${plugin.actions?.length ?? 0}\n`);
  out.write(`  matchers:  ${plugin.matchers?.length ?? 0}\n`);
  const faults = faultsIn(plugin);
  for (const fault of faults) out.write(`  ✗ ${fault}\n`);
  out.write(faults.length === 0 ? "\n✓ plugin shape is valid\n" : "\n✗ plugin shape is invalid\n");
  return faults.length === 0 ? 0 : 1;
}

/**
 * Everything wrong with what this plugin declares, in the reader's words.
 *
 * The verdict used to be `Boolean(plugin.name && plugin.namespace)`, which
 * `isPlugin` has already required by the time it is asked, so the command could
 * not fail. What it exists to catch is the shape a registry will choke on: a
 * verb with nothing to run, a matcher that decides nothing or says nothing, and
 * a capability no host has ever offered, which fails the load rather than the
 * call.
 */
function faultsIn(plugin: PluginDefinition): string[] {
  const known = ALL_CAPABILITIES as readonly string[];
  return [
    ...uncallable({ items: plugin.actions ?? [], methods: ["run"], what: "action" }),
    ...uncallable({ items: plugin.matchers ?? [], methods: ["test", "message"], what: "matcher" }),
    ...(plugin.requires ?? [])
      .filter((cap) => !known.includes(String(cap)))
      .map((cap) => `requires "${String(cap)}", which no host offers.`),
  ];
}

/**
 * The check `assertPortShape` makes, asked of a plugin's own declarations: a
 * name that was declared and is not callable is a name that will throw the
 * first time anything reaches it.
 */
function uncallable(args: {
  items: readonly { name?: string }[];
  methods: readonly string[];
  what: string;
}): string[] {
  const found: string[] = [];
  for (const item of args.items) {
    const bag = item as Record<string, unknown>;
    const absent = args.methods.filter((method) => typeof bag[method] !== "function");
    for (const method of absent) {
      found.push(`${args.what} "${item.name ?? "?"}" has no callable ${method}.`);
    }
  }
  return found;
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
