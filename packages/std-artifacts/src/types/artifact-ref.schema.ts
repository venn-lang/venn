import { type ZodType, z } from "@venn-lang/sdk";
import type { ArtifactRef } from "./artifact-ref.types.js";

/** Runtime validator for the nominal `artifacts.ArtifactRef` type. */
export const ArtifactRefSchema: ZodType<ArtifactRef> = z.object({
  name: z.string(),
  kind: z.string(),
  size: z.number().optional(),
});
