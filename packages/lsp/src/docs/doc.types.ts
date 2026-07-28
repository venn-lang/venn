/** One documented parameter. */
export interface DocParam {
  name: string;
  text: string;
}

/**
 * A parsed documentation block: the `##` lines above a declaration, or its
 * `@doc("…")` annotation (§08). Summary and every field are markdown.
 */
export interface DocBlock {
  summary: string;
  params: DocParam[];
  returns?: string;
  examples: string[];
  deprecated?: string;
}
