import { type AstNode, AstUtils } from "langium";

/** Every descendant of `root`, depth-first, for whole-document passes. */
export function walkAst(root: AstNode): AstNode[] {
  return AstUtils.streamAllContents(root).toArray();
}
