/** A run identifier (ULID). Branded so it is not confused with a plain string. */
export type RunId = string & { readonly __brand: "RunId" };

/**
 * A node path derived from `@id`, e.g. "checkout/flow-checkout/step-cart".
 *
 * The join key across the node graph, the editor margin, and the execution
 * tree. Never a numeric index: an edit would silently desync history.
 */
export type NodePath = string & { readonly __brand: "NodePath" };

/**
 * One run of one step, minted when it starts.
 *
 * Distinct from {@link NodePath}, which names a step in the source: a step
 * inside a `forEach` has one path and one id per pass. This is what tells two
 * overlapping steps apart, which is what `parallel` and `race` produce by
 * design.
 */
export type StepId = string & { readonly __brand: "StepId" };
