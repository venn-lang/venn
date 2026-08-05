import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { contentActions, questionActions } from "./actions/index.js";

/**
 * The `fs` plugin: reading a file whole, writing one whole, and asking what is
 * on the disk.
 *
 * Requires the host capability `fs`, so a host with no disk refuses the plugin
 * once at load time with VN2010 rather than failing on the first read. There is
 * no second filesystem here: every byte goes through `venn.port.filesystem`,
 * the port the CLI, the tests and the editor's worker each bind for themselves.
 */
export const fsPlugin: PluginDefinition = definePlugin({
  name: "venn/fs",
  namespace: "fs",
  requires: ["fs"],
  actions: [...contentActions, ...questionActions],
});
