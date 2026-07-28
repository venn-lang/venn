import type { AstNode } from "langium";

/**
 * Put `next` where `node` is, in its parent's list or in the field holding it.
 * Passing nothing takes the node out of the program entirely.
 *
 * The write goes straight into the parent's own array or field. That is the tree
 * the checker and the runtime read, not a copy of it, so a decorator's rewrite
 * is indistinguishable downstream from source the author wrote.
 */
export function swapNode(node: AstNode, next: AstNode | undefined): void {
  const parent = node.$container as Record<string, unknown> | undefined;
  const property = node.$containerProperty;
  if (!parent || !property) return;
  const held = parent[property];
  if (Array.isArray(held)) {
    swapInList(held, node, next);
    return;
  }
  parent[property] = next;
}

function swapInList(list: unknown[], node: AstNode, next: AstNode | undefined): void {
  const at = list.indexOf(node);
  if (at < 0) return;
  if (next) list[at] = next;
  else list.splice(at, 1);
}
