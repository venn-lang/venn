import { type ActionDefinition, defineAction } from "@venn/sdk";
import { t } from "@venn/types";
import { ArtifactStorePort } from "../store/index.js";

/**
 * `artifacts.flush`.
 *
 * Persists everything buffered since the last flush and empties the buffer.
 * Stored refs survive; only the pending queue is drained.
 *
 * @returns the list of `artifacts.ArtifactRef` that were written out.
 */
export const flushAction: ActionDefinition = defineAction({
  name: "flush",
  doc: "Flush pending artifacts, returning the refs that were drained.",
  result: t.list(t.ref("artifacts.ArtifactRef")),
  run: (ctx) => ctx.port(ArtifactStorePort).flush(),
});
