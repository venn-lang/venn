import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { consoleActions } from "./actions/console-actions.js";

/**
 * The `io` plugin: a script's standard input, standard output and arguments.
 *
 * Requires the host capability `io`. Where the host has no real console streams
 * the plugin refuses to load with a readable diagnostic, rather than failing
 * mid-run.
 */
export const ioPlugin: PluginDefinition = definePlugin({
  name: "@venn/io",
  version: "0.0.0",
  namespace: "io",
  requires: ["io"],
  actions: consoleActions,
});
