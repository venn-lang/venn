import {
  type ActionCall,
  isActionCall,
  isAnnotation,
  isMatcherClause,
  isRunStmt,
} from "@venn/core";
import { GrammarUtils } from "langium";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver";
import type { HighlightArgs } from "./highlight.types.js";

/** Everything that reads as an invocation: actions, matchers, fragments, annotations. */
export function highlightCalls(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (isActionCall(node)) target(node, args);
  else if (isMatcherClause(node))
    acceptor({ node, property: "name", type: SemanticTokenTypes.method });
  else if (isAnnotation(node))
    acceptor({ node, property: "name", type: SemanticTokenTypes.decorator });
  else if (isRunStmt(node)) runTarget(args);
}

function runTarget(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (!isRunStmt(node)) return;
  // The same type the declaration carries: what `run` names is a fragment, and
  // the two places the reader sees that name should agree about what it is.
  acceptor({ node, property: "target", type: SemanticTokenTypes.macro });
  if (node.bind) {
    const type = SemanticTokenTypes.variable;
    acceptor({ node, property: "bind", type, modifier: SemanticTokenModifiers.declaration });
  }
}

// `http.get` is a single grammar token: colour the namespace and the action apart.
function target(node: ActionCall, args: HighlightArgs): void {
  const cst = GrammarUtils.findNodeForProperty(node.$cstNode, "target");
  if (!cst) return;
  const dot = node.target.indexOf(".");
  const { line, character } = cst.range.start;
  const known = dot > 0 && args.catalog.hasNamespace(node.target.slice(0, dot));
  const modifier = known ? SemanticTokenModifiers.defaultLibrary : [];
  if (dot > 0) {
    const options = { line, char: character, length: dot, type: SemanticTokenTypes.namespace };
    args.acceptor({ ...options, modifier });
  }
  const from = dot > 0 ? dot + 1 : 0;
  const length = node.target.length - from;
  args.acceptor({
    line,
    char: character + from,
    length,
    type: SemanticTokenTypes.function,
    modifier,
  });
}
