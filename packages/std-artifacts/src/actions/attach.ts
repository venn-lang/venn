import { type ActionDefinition, type ActionInput, arg, defineAction, z } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";
import { ArtifactStorePort } from "../store/index.js";
import type { ArtifactRef } from "../types/index.js";

const attachParams = z.object({ kind: z.string().optional(), size: z.number().optional() });

/**
 * `artifacts.attach "screenshot.png" { kind: "image", size: 4096 }`.
 *
 * Files one already existing artifact under a name so the report can show it.
 * `kind` defaults to `attachment` and `size` stays absent when not given.
 *
 * @returns the stored `artifacts.ArtifactRef`.
 */
export const attachAction: ActionDefinition = defineAction({
  name: "attach",
  doc: "Attach an artifact by name, with an optional kind and size.",
  params: attachParams.optional(),
  args: [arg("name", t.string, "What to file it under.")],
  result: t.ref("artifacts.ArtifactRef"),
  run: (ctx, input) => ctx.port(ArtifactStorePort).put(buildRef(input)),
});

function buildRef(input: ActionInput<unknown>): ArtifactRef {
  const params = (input.params ?? {}) as { kind?: string; size?: number };
  return {
    name: String(input.args[0] ?? ""),
    kind: params.kind ?? "attachment",
    size: params.size,
  };
}
