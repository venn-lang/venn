import type { NodeMeta } from "./expand.types.js";

/** Where a decorator's leavings live on the node. */
const META = "$meta";

/**
 * What the decorators left on this node, or nothing.
 *
 * Metadata rather than a rewrite is how a decorator says something the grammar
 * has no word for. `@retry(2)` cannot be expressed as a tree of existing
 * statements, so it is expressed as a fact about one.
 */
export function metaOf(node: object): NodeMeta | undefined {
  return (node as { $meta?: NodeMeta }).$meta;
}

/** Read one key, typed by the caller who knows what it wrote. */
export function readMeta<T>(node: object, key: string): T | undefined {
  return metaOf(node)?.[key] as T | undefined;
}

/** Attach a fact to a node. Non-enumerable, so it never lands in a serialised AST. */
export function writeMeta(node: object, key: string, value: unknown): void {
  const existing = metaOf(node);
  if (existing) {
    existing[key] = value;
    return;
  }
  Object.defineProperty(node, META, { value: { [key]: value }, configurable: true });
}
