import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { fmtActions } from "./actions/fmt-actions.js";

/**
 * The `fmt` plugin: a value to text, as JSON, a table, YAML, CSV or XML.
 *
 * Every verb is pure, so the plugin needs no host capability and runs anywhere,
 * the LSP included. What comes back is a string, yours to print, compare or send.
 */
export const fmtPlugin: PluginDefinition = definePlugin({
  name: "venn/fmt",
  version: "0.0.0",
  namespace: "fmt",
  actions: fmtActions,
});
