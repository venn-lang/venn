import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { buildActions } from "./actions/build.js";
import { partActions } from "./actions/parts.js";
import { questionActions } from "./actions/questions.js";

/**
 * The `path` plugin: joining a path, taking one apart, and asking where it
 * leads.
 *
 * The separator is never an argument and never an answer. It belongs to the
 * host, which is the difference between a program that runs on one machine and
 * one that runs on whichever machine it is handed to.
 */
export const pathPlugin: PluginDefinition = definePlugin({
  name: "venn/path",
  namespace: "path",
  actions: [...buildActions, ...partActions, ...questionActions],
});
