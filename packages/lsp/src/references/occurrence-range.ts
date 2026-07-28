import { GrammarUtils } from "langium";
import type { Range } from "vscode-languageserver";
import type { Occurrence } from "./symbol.types.js";

/** Where an occurrence sits in the text, or nothing when the CST has no node. */
export function rangeOf(occurrence: Occurrence): Range | undefined {
  const cst = GrammarUtils.findNodeForProperty(
    occurrence.node.$cstNode,
    occurrence.property,
    occurrence.index,
  );
  return cst?.range;
}

/** The occurrences that resolved to a real range, as ranges. */
export function rangesOf(occurrences: readonly Occurrence[]): Range[] {
  const found: Range[] = [];
  for (const each of occurrences) {
    const range = rangeOf(each);
    if (range) found.push(range);
  }
  return found;
}
