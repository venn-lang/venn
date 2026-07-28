import { definePlugin, type PluginDefinition } from "@venn/sdk";

/**
 * The `env` plugin: the namespace behind `env.NAME`.
 *
 * It contributes no verbs, because `env.NAME` is a read, not a call. What it
 * contributes is the name itself, so a file that reads configuration has to say
 * so with `use`, exactly like one that makes a request or an assertion. The
 * values come from the `[env.*]` tables of `venn.toml`, chosen with `--env`.
 */
export const envPlugin: PluginDefinition = definePlugin({
  name: "@venn/env",
  version: "0.0.0",
  namespace: "env",
});
