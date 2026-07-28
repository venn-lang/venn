/**
 * The receipt for a stored artifact: a trace, a video, a HAR, a screenshot.
 * `kind` names the category. `size` is the byte count, absent until known.
 */
export interface ArtifactRef {
  name: string;
  kind: string;
  size?: number;
}
