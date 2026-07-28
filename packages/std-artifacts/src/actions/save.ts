import { type ActionDefinition, defineAction, restArg } from "@venn/sdk";
import { t } from "@venn/types";
import { ArtifactStorePort } from "../store/index.js";
import type { ArtifactRef } from "../types/index.js";

/**
 * `artifacts.save trace video har`.
 *
 * Each positional argument names a kind of artifact to keep from this run. One
 * ref is stored per kind, in the order given.
 *
 * @returns the list of stored `artifacts.ArtifactRef`, one per kind.
 */
export const saveAction: ActionDefinition = defineAction({
  name: "save",
  doc: "Store one artifact per positional kind ref and return the stored refs.",
  // The vocabulary has no variadic, so `restArg` types the first kind and
  // leaves the rest unchecked. Better an unchecked argument than a wrong type.
  args: [restArg("kinds", t.string, "One or more kinds to store, as positional arguments.")],
  result: t.list(t.ref("artifacts.ArtifactRef")),
  run: async (ctx, input) => {
    const store = ctx.port(ArtifactStorePort);
    return Promise.all(input.args.map((kind) => store.put(toRef(kind))));
  },
});

function toRef(kind: unknown): ArtifactRef {
  const name = String(kind);
  return { name, kind: name };
}
