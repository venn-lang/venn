import { type AstNode, isForEachStmt, isRepeatStmt } from "@venn-lang/core";

/**
 * Which property of a declaration carries the name it binds.
 *
 * Most spell it `name`; a `forEach` calls its variable `item` and a `repeat`
 * calls its counter `index`. Kept in one place because every reader of a
 * declaration needs the answer, and copies of it drift.
 */
export function nameProperty(node: AstNode | object): string | undefined {
  if (isForEachStmt(node)) return "item";
  if (isRepeatStmt(node)) return "index";
  return "name" in node ? "name" : undefined;
}
