/**
 * `@venn/artifacts`: the verbs that record what a run left behind (traces,
 * videos, HARs, screenshots) and the `ArtifactStore` port that keeps them.
 */

export { artifactsPlugin, artifactsPlugin as default } from "./plugin.js";
export * from "./store/index.js";
export * from "./types/index.js";
