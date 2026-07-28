import type { Port } from "@venn/contracts";
import type { ArtifactStore } from "./artifact-store.types.js";

/**
 * The port the `artifacts` verbs reach through to keep what a run produced.
 * Requires the `fs` capability, so a host without it fails to load the plugin
 * rather than failing mid-run.
 */
export const ArtifactStorePort: Port<ArtifactStore> = {
  id: "venn.port.artifact-store",
  version: 1,
  requires: ["fs"],
  // List every method an action reaches for. An omission is not checked at load
  // time, so it surfaces as a TypeError mid-run instead of a legible VN2011.
  methods: ["put", "get", "list", "flush"],
};
