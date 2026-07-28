import { definePlugin, type PluginDefinition } from "@venn-lang/sdk";
import { artifactsActions } from "./actions/index.js";
import { ArtifactRefSchema, artifactsTypeDefs } from "./types/index.js";

/**
 * The `@venn-lang/artifacts` plugin. Registers the `artifacts` namespace: the
 * `save`, `flush` and `attach` verbs and the nominal `artifacts.ArtifactRef`
 * type. Requires the `fs` capability, since the store writes to disk.
 */
export const artifactsPlugin: PluginDefinition = definePlugin({
  name: "venn/artifacts",
  version: "0.0.0",
  namespace: "artifacts",
  requires: ["fs"],
  actions: artifactsActions,
  types: { ArtifactRef: ArtifactRefSchema },
  typeDefs: artifactsTypeDefs,
});
