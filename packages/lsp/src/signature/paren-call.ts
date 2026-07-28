import type { AstNode } from "@venn/core";
import { CstUtils, type LangiumDocument } from "langium";

/** A bracketed call the cursor is inside, read from the text. */
export interface ParenCall {
  /** The dotted name being called: `saudacao`, `fmt.json`. */
  path: string;
  /** Which argument is being written, counted by the commas before it. */
  active: number;
  /** A node in the same scope, for looking the name up. */
  host: AstNode | undefined;
}

/**
 * The innermost `f(…)` whose brackets hold the cursor.
 *
 * Read from the text rather than from the tree, because the states that most
 * need explaining are exactly the ones that do not parse: `f("a", ▮)` has a
 * trailing comma, which is a syntax error, and a hint that disappears the
 * moment you press comma is a hint that is never there when wanted.
 */
export function enclosingParenCall(
  document: LangiumDocument,
  offset: number,
): ParenCall | undefined {
  const text = document.textDocument.getText();
  const open = innermostOpenParen(text, offset);
  if (open < 0) return undefined;
  const path = nameBefore(text.slice(0, open));
  if (!path) return undefined;
  return { path, active: commas(text.slice(open + 1, offset)), host: nodeNear(document, open) };
}

/** How far back to look for the bracket. A call this long is not being typed. */
const REACH = 2000;

/** The `(` still open at the cursor, scanning backwards. */
function innermostOpenParen(text: string, offset: number): number {
  let depth = 0;
  for (let at = offset - 1; at >= Math.max(0, offset - REACH); at -= 1) {
    const char = text[at];
    if (char === ")") depth += 1;
    else if (char === "(") {
      if (depth === 0) return at;
      depth -= 1;
    }
  }
  return -1;
}

const CALLEE = /([A-Za-z_]\w*(?:\.\w+)*)$/;

/** The dotted name written immediately before the bracket. */
function nameBefore(before: string): string | undefined {
  return CALLEE.exec(before)?.[1];
}

/** Commas at this bracket's own level: those in a nested call are not ours. */
function commas(inside: string): number {
  let depth = 0;
  let count = 0;
  for (const char of inside) {
    if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (char === "," && depth === 0) count += 1;
  }
  return count;
}

/** Any node at the bracket, so a name can be looked up in the right scope. */
function nodeNear(document: LangiumDocument, offset: number): AstNode | undefined {
  const root = document.parseResult?.value?.$cstNode;
  if (!root) return undefined;
  const leaf =
    CstUtils.findLeafNodeAtOffset(root, offset) ?? CstUtils.findLeafNodeBeforeOffset(root, offset);
  return leaf?.astNode;
}
