import { type HostCapability, missingCapabilities } from "@venn-lang/contracts";
import type { PluginDefinition } from "@venn-lang/sdk";
import { describe, expect, it } from "vitest";
import { allPlugins } from "./plugins.js";
import { EACH_PLUGIN, reachOf } from "./port-reach.js";

/**
 * A plugin must declare every capability its verbs reach, and nothing checked that
 * until this file. See {@link Reach} for what went wrong without it.
 *
 * The other half of the rule, that a verb claiming `pure` must reach nothing, is
 * `a-verb-may-claim-purity.test.ts`. Two facts, two files, one walk.
 */
async function undeclared(plugin: PluginDefinition): Promise<readonly HostCapability[]> {
  const reach = await reachOf(plugin);
  return missingCapabilities({
    // `ReachedPort` widens a capability to a string so that a file which ships
    // need not import `@venn-lang/contracts`, which is a devDependency here.
    // The values are the ports' own, so they are capabilities whatever the
    // record calls them.
    requires: [...reach.ports.values()].flatMap((port) => [...port.requires] as HostCapability[]),
    caps: plugin.requires ?? [],
  });
}

/**
 * Every port each namespace was observed to reach, by port id.
 *
 * Written down as the positive claim, so that a plugin reaching somewhere new fails
 * this file rather than passing quietly. An empty list is a claim too, and the
 * load-bearing one: it is what lets a `fn` call that namespace.
 *
 * THE GUARD'S HONEST EDGE. Actions are driven with empty arguments, so a little over
 * a hundred of the stdlib's two hundred and sixty-odd verbs threw before asking for
 * a port, and this file proves nothing about those individually: `data` alone
 * accounted for 97 of them when this was written, and `json.parse`, `date.format`,
 * `path.stem`, `math.log` and `http.on` are among the rest. What it does prove is
 * per namespace, which is the grain `requires` is declared at: for every namespace
 * below, the ports observed are covered by the declaration. A verb reaching a port
 * none of its namespace-mates reaches, and only on a real argument, would escape.
 * Closing that needs an argument fixture per verb, and the namespaces where it would
 * matter are the ones with no declaration at all: `fmt` and `mock` were driven to
 * completion with nothing thrown, while `json` and `path` have three verbs between
 * them that were not.
 */
const PORTS_REACHED: Readonly<Record<string, readonly string[]>> = {
  artifacts: ["venn.port.artifact-store"],
  assert: [],
  auth: ["venn.port.crypto-engine", "venn.port.auth-client"],
  browser: ["venn.port.browser-driver"],
  crypto: ["venn.port.crypto-engine"],
  data: ["venn.port.random"],
  date: ["venn.port.clock"],
  db: ["venn.port.db-client"],
  env: [],
  fmt: [],
  fs: ["venn.port.filesystem"],
  gql: ["venn.port.gql-client"],
  grpc: ["venn.port.grpc-client"],
  http: ["venn.port.http-client", "venn.port.http-server"],
  io: ["venn.port.console"],
  json: [],
  load: ["venn.port.load-runner"],
  mail: ["venn.port.mail-client"],
  math: ["venn.port.random"],
  mock: [],
  mqtt: ["venn.port.mqtt-client"],
  notify: ["venn.port.notifier"],
  path: ["venn.port.paths"],
  ws: ["venn.port.ws-client"],
};

/**
 * The namespaces every verb of which a `fn` may call, being those declaring nothing.
 *
 * This is the purity rule's data, read the way `check-pure-verb.ts` reads it, so a
 * declaration added or removed anywhere in the stdlib has to come past this list.
 * Adding a capability to a plugin on it takes its verbs out of every `fn` in every
 * program, and that is a language change rather than a packaging detail. Verbs of
 * OTHER namespaces may also be callable, one at a time, by declaring `pure`; those
 * are listed in `a-verb-may-claim-purity.test.ts`.
 *
 * `path` is here while reaching `PathsPort`, correctly: that port declares no
 * capability, on the documented ground that working out where a path leads is text
 * rather than I/O. `mock` is here and should not be, and no capability fixes it: its
 * verbs reach no port at all and keep state in a module-level store, so
 * `mock.flag("x")` answers differently depending on what ran before it. `requires`
 * cannot express state, `atFlowStart` is the field that could and is declared by
 * nobody, and inventing a capability `mock` does not ask the host for would be a
 * purity flag wearing a capability's name.
 */
const CALLABLE_IN_A_FN = ["assert", "env", "fmt", "json", "mock", "path"];

/** The capability every declaring namespace is expected to hold. */
const DECLARED: Readonly<Record<string, readonly string[]>> = {
  auth: ["net", "random"],
  crypto: ["random"],
  data: ["random"],
  date: ["clock"],
  fs: ["fs"],
  io: ["io"],
  math: ["random"],
};

describe("a plugin declares every capability its actions reach", () => {
  it.each(EACH_PLUGIN)("%s declares what its verbs ask the host for", async (_ns, plugin) => {
    expect(await undeclared(plugin)).toEqual([]);
  });
});

describe("what the stdlib reaches is written down", () => {
  it.each(EACH_PLUGIN)("%s reaches the ports recorded for it", async (namespace, plugin) => {
    const reach = await reachOf(plugin);

    expect([...reach.ports.keys()].sort()).toEqual([...(PORTS_REACHED[namespace] ?? [])].sort());
  });

  it.each(EACH_PLUGIN)("%s had at least one verb driven, if it has any", async (_ns, plugin) => {
    const verbs = (plugin.actions ?? []).length;

    expect(verbs === 0 || (await reachOf(plugin)).undriven < verbs).toBe(true);
  });
});

describe("the purity rule's data", () => {
  it("lets a fn call every verb of exactly the namespaces declaring no capability", () => {
    const free = allPlugins
      .filter((plugin) => (plugin.requires ?? []).length === 0)
      .map((plugin) => plugin.namespace);

    expect(free.sort()).toEqual(CALLABLE_IN_A_FN);
  });

  it.each(Object.entries(DECLARED))("keeps %s out of a fn by default", (namespace, caps) => {
    const plugin = allPlugins.find((one) => one.namespace === namespace);

    expect([...(plugin?.requires ?? [])].sort()).toEqual([...caps]);
  });
});
