import {
  type ActionCall,
  type Expr,
  isActionCall,
  isMatcherClause,
  type MatcherClause,
} from "@venn/core";
import { AstUtils, type LangiumDocument } from "langium";

/** Anything written as a bare word followed by bare arguments. */
interface Bareword {
  args?: readonly Expr[];
  readonly $cstNode?: { offset: number };
}

/**
 * The action call the cursor is writing, if it is writing one.
 *
 * Not found by walking up from the token under the cursor: the cursor is on
 * whitespace here (`http.on ` is the whole point), and in this grammar the
 * newline is a real token belonging to the document, not to the statement. So
 * the call is found by where it starts instead: the one that begins on this
 * line, before the cursor. A statement holds at most one, so there is no
 * innermost to choose between.
 */
export function enclosingCall(document: LangiumDocument, offset: number): ActionCall | undefined {
  const root = document.parseResult?.value;
  if (!root) return undefined;
  const from = lineStart(document.textDocument.getText(), offset);
  let found: ActionCall | undefined;
  for (const node of AstUtils.streamAst(root)) {
    const start = node.$cstNode?.offset;
    if (isActionCall(node) && start !== undefined && start >= from && start < offset) found = node;
  }
  return found;
}

/** The same for `expect subject contains ▮`; a matcher takes bare arguments too. */
export function enclosingMatcher(
  document: LangiumDocument,
  offset: number,
): MatcherClause | undefined {
  const root = document.parseResult?.value;
  if (!root) return undefined;
  const from = lineStart(document.textDocument.getText(), offset);
  let found: MatcherClause | undefined;
  for (const node of AstUtils.streamAst(root)) {
    const start = node.$cstNode?.offset;
    if (isMatcherClause(node) && start !== undefined && start >= from && start < offset) {
      found = node;
    }
  }
  return found && offset > (found.$cstNode?.offset ?? 0) + found.name.length ? found : undefined;
}

function lineStart(text: string, offset: number): number {
  return text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
}

/**
 * Which argument the cursor is on.
 *
 * An argument that ends before the cursor has been written; one that ends at it
 * is still being typed. So `http.on api|` is on the first argument and
 * `http.on api |` has moved to the second, which is what makes the highlight
 * move as the space is pressed rather than a keystroke late.
 */
export function activeArg(call: Bareword, offset: number): number {
  let written = 0;
  for (const arg of call.args ?? []) {
    const end = arg.$cstNode?.end;
    if (end === undefined || end >= offset) break;
    written += 1;
  }
  return written;
}

/** Whether the cursor sits after the verb rather than still inside its name. */
export function pastTarget(call: ActionCall, offset: number): boolean {
  const start = call.$cstNode?.offset ?? 0;
  return offset > start + call.target.length;
}
