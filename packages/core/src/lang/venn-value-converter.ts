import type { CstNode, GrammarAST, ValueType } from "langium";
import { DefaultValueConverter } from "langium";

/**
 * Turns the two extra string forms into their text, since Langium only knows how
 * to unquote the one it recognises.
 *
 * A block keeps every newline inside it, and a raw string keeps every backslash.
 * Both still interpolate: `${…}` is scanned later, out of the value this leaves.
 */
export class VennValueConverter extends DefaultValueConverter {
  protected override runConverter(
    rule: GrammarAST.AbstractRule,
    input: string,
    cstNode: CstNode,
  ): ValueType {
    if (rule.name === "BLOCK_STRING") return unescaped(input.slice(3, -3));
    if (rule.name === "RAW_STRING") return input.slice(2, -1);
    return super.runConverter(rule, input, cstNode);
  }
}

/** What a backslash means, matching the ordinary string form. */
const ESCAPES: Readonly<Record<string, string>> = {
  n: "\n",
  r: "\r",
  t: "\t",
  "\\": "\\",
  '"': '"',
  "'": "'",
  "0": "\0",
};

/**
 * The escapes a block string still honours.
 *
 * A block is for text that reads as itself, so the newlines in it are already
 * newlines and nobody writes `\n`. But `\"` has to work, or a line ending in a
 * quote could not be written at all, and once one escape is honoured the rest
 * have to be too.
 */
function unescaped(text: string): string {
  return text.replace(/\\(.)/g, (whole, char: string) => ESCAPES[char] ?? whole);
}
