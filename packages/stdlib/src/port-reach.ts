import type { ActionContext, ActionDefinition, PluginDefinition } from "@venn-lang/sdk";
import { allPlugins } from "./plugins.js";
import type { Reach, ReachedPort } from "./port-reach.types.js";

/**
 * A stand-in that answers any property and any call.
 *
 * A driven action is handed `{ args: [], params: {} }`, so most of them fail
 * somewhere. The point is to carry them past their FIRST port far enough to reach
 * a second: `crypto.password.hash` asks for the engine twice, and an action that
 * gave up on the first answer would hide the rest of its reach.
 */
function anything(): unknown {
  const answer = (): unknown => anything();
  return new Proxy(answer, {
    // `then` has to stay absent, or awaiting a driven action's result waits
    // forever on a thenable that never settles.
    get: (_target, key) => (key === "then" ? undefined : anything()),
    apply: () => anything(),
  });
}

/** A context that records the ports an action asks for and satisfies none of them. */
function probe(into: Map<string, ReachedPort>): ActionContext {
  return {
    port: <T>(port: { id: string }): T => {
      into.set(port.id, port as ReachedPort);
      return anything() as T;
    },
    secrets: anything() as ActionContext["secrets"],
    config: {},
    log: () => undefined,
    show: (value) => String(value),
    invoke: () => anything(),
  };
}

/** Whether the action ran to an answer. A throw is expected, not a failure. */
async function drove(action: ActionDefinition, ctx: ActionContext): Promise<boolean> {
  try {
    await action.run(ctx, { args: [], params: {} });
    return true;
  } catch {
    return false;
  }
}

/**
 * Drive every action of one plugin and collect what it reached.
 *
 * A plugin holds opaque closures, so nothing at load can see which ports a `run`
 * will reach without executing it. That is why this drives the actions rather than
 * reading the definition object, and why the guards over it are tests rather than a
 * condition inside `ctx.port`: refusing at call time is the mid-run failure the
 * capability model exists to prevent, and answering one mid-run refusal with
 * another is going backwards.
 *
 * @param plugin The plugin to drive, actions and all.
 * @returns What its verbs asked for, how many could not be placed, and any that
 * claimed purity while asking for a port.
 */
export async function reachOf(plugin: PluginDefinition): Promise<Reach> {
  const ports = new Map<string, ReachedPort>();
  const claimed: string[] = [];
  let undriven = 0;
  for (const action of plugin.actions ?? []) {
    const asked = new Map<string, ReachedPort>();
    const answered = await drove(action, probe(asked));
    for (const [id, port] of asked) ports.set(id, port);
    if (!answered && asked.size === 0) undriven += 1;
    if (action.pure && asked.size > 0) claimed.push(action.name);
  }
  return { ports, undriven, claimed };
}

/** Each plugin paired with its namespace, so a failing row names the namespace. */
export const EACH_PLUGIN: readonly (readonly [string, PluginDefinition])[] = allPlugins.map(
  (plugin) => [plugin.namespace, plugin] as const,
);
