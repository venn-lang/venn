import { dottedPath, type Expr, isActionCall, isLetStmt, type LetStmt } from "@venn-lang/core";
import { type AstNode, AstUtils, type LangiumDocument } from "langium";

/** A call written without brackets, wherever the language allows one. */
export interface BareCall {
  /** The verb being called: `http.get`. */
  target: string;
  /** The bare arguments after it, in order. */
  args: readonly Expr[];
  /** Where the verb's own name ends; the cursor must be past it. */
  after: number;
  /** The node it was found on, for looking names up in scope. */
  node: AstNode;
}

/**
 * The bracket-less call the cursor is writing.
 *
 * Two nodes spell one thing. `http.get "u"` standing alone is an action call;
 * bound with `const r = http.get "u"` it is a `let` whose value happens to name
 * a verb, with the arguments hanging off the statement. The same words deserve
 * the same help, so both are found here.
 */
export function enclosingBareCall(document: LangiumDocument, offset: number): BareCall | undefined {
  const root = document.parseResult?.value;
  if (!root) return undefined;
  const from = lineStart(document.textDocument.getText(), offset);
  let found: BareCall | undefined;
  for (const node of AstUtils.streamAst(root)) {
    const start = node.$cstNode?.offset;
    if (start === undefined || start < from || start >= offset) continue;
    found = asBareCall(node) ?? found;
  }
  return found && offset > found.after ? found : undefined;
}

function asBareCall(node: unknown): BareCall | undefined {
  if (isActionCall(node)) {
    const start = node.$cstNode?.offset ?? 0;
    return { target: node.target, args: node.args, after: start + node.target.length, node };
  }
  return isLetStmt(node) ? letCall(node) : undefined;
}

/** `const r = http.get "u" { … }`: the verb is the value, the args follow it. */
function letCall(node: LetStmt): BareCall | undefined {
  const target = dottedPath(node.value);
  const end = node.value.$cstNode?.end;
  if (!target || end === undefined) return undefined;
  return { target, args: node.args, after: end, node };
}

function lineStart(text: string, offset: number): number {
  return text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
}
