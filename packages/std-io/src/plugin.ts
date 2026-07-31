import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { consoleActions } from "./actions/console-actions.js";
import { inputActions } from "./actions/input-actions.js";
import { screenActions } from "./actions/screen-actions.js";

/**
 * The `io` plugin: a script's standard streams, the terminal behind them, and
 * the process arguments.
 *
 * Requires the host capability `io`. Where the host has no real console streams
 * the plugin refuses to load with a readable diagnostic, rather than failing
 * mid-run.
 */
export const ioPlugin: PluginDefinition = definePlugin({
  name: "venn/io",
  version: "0.0.0",
  namespace: "io",
  requires: ["io"],
  actions: [...consoleActions, ...inputActions, ...screenActions],
});
