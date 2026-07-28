import { type AstNode, EXPRESSION_OFFSET } from "@venn/core";
import { type CstNode, CstUtils, type LangiumDocument, type LeafCstNode } from "langium";
import { slotAt } from "./interpolation-at.js";

/** The slots a document's inference recorded, keyed by string literal. */
export interface SlotSource {
  slots: ReadonlyMap<AstNode, readonly (AstNode | undefined)[]>;
}

/**
 * The node a name at this offset should be resolved against.
 *
 * Usually that is simply the node under the cursor. Inside `"${…}"` it is not:
 * the document's tree stops at the string, so a lambda parameter written in
 * there exists only in the expression inference parsed. This reaches that one,
 * which is what makes `p` in `"${xs.map(fn (p) => p.name)}"` resolve at all.
 */
export function hostAt(args: HostArgs): AstNode | undefined {
  return inInterpolation(args) ?? nodeAt(args);
}

export interface HostArgs {
  document: LangiumDocument;
  offset: number;
  types: SlotSource;
  /**
   * Which token answers. Hover asks about the one under the cursor; completion
   * about the one that *ends* at it, since `p.` is typed before it is asked.
   */
  prefer?: "at" | "before";
}

function inInterpolation(args: HostArgs): AstNode | undefined {
  const hit = slotAt(args);
  if (!hit) return undefined;
  const root = args.types.slots.get(hit.host)?.[hit.index];
  const cst = root?.$cstNode;
  return cst && leafNear(cst, hit.inner + EXPRESSION_OFFSET, args.prefer)?.astNode;
}

function nodeAt(args: HostArgs): AstNode | undefined {
  const root = args.document.parseResult?.value?.$cstNode;
  return root ? leafNear(root, args.offset, args.prefer)?.astNode : undefined;
}

/**
 * Mid-typing, the cursor often sits past the last token the parser kept (`p.`
 * at the end of a line), so fall back to the token just before it.
 */
function leafNear(
  root: CstNode,
  offset: number,
  prefer?: "at" | "before",
): LeafCstNode | undefined {
  // Langium's "before" still returns a token that *starts* at the offset, so
  // asking for the one that ends at the cursor means asking one back.
  const where = prefer === "before" ? offset - 1 : offset;
  return (
    CstUtils.findLeafNodeAtOffset(root, where) ?? CstUtils.findLeafNodeBeforeOffset(root, where)
  );
}
