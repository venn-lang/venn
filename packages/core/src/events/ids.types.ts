/** A run identifier (ULID). Branded so it is not confused with a plain string. */
export type RunId = string & { readonly __brand: "RunId" };

/**
 * A node path derived from `@id`, e.g. "checkout/flow-checkout/step-cart".
 *
 * The join key across the node graph, the editor margin, and the execution
 * tree. Never a numeric index: an edit would silently desync history.
 */
export type NodePath = string & { readonly __brand: "NodePath" };
