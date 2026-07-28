import { definePlugin, type PluginDefinition } from "@venn/sdk";
import { assertMatchers } from "./matchers/index.js";

/**
 * The `assert` plugin: the vocabulary behind `expect`.
 *
 * `expect` is kernel syntax; the words that follow it are not. This plugin
 * contributes those words and nothing else, so it declares no verbs, no
 * resources, no types and no host capabilities.
 */
export const assertPlugin: PluginDefinition = definePlugin({
  name: "@venn/assert",
  version: "0.0.0",
  namespace: "assert",
  matchers: assertMatchers,
});
