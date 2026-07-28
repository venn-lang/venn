import { type TypeSpec, t } from "@venn/types";

/**
 * The types `@venn/artifacts` publishes to the checker, under the `artifacts`
 * namespace. Kept as data, and mirroring `artifact-ref.types.ts` by hand, so a
 * generator reading the emitted `.d.ts` can replace this file unnoticed.
 */
export const artifactsTypeDefs: Readonly<Record<string, TypeSpec>> = {
  /**
   * The receipt for a stored artifact: a trace, a video, a HAR, a screenshot.
   * `size` is absent until the store knows how many bytes it kept.
   */
  ArtifactRef: t.record({ name: t.string, kind: t.string, size: t.number }, { optional: ["size"] }),
};
