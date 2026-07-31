import {
  type AstNode,
  isBreakStmt,
  isCaptureStmt,
  isConfigDecl,
  isContinueStmt,
  isDatasetDecl,
  isDecoDecl,
  isDocument,
  isExpectStmt,
  isFactoryDecl,
  isFlowDecl,
  isFnDecl,
  isForEachStmt,
  isFragmentDecl,
  isGroupDecl,
  isIfStmt,
  isLetStmt,
  isLifecycleDecl,
  isLoopStmt,
  isMatrixDecl,
  isParallelStmt,
  isRaceStmt,
  isRepeatStmt,
  isReportDecl,
  isReturnStmt,
  isRunStmt,
  isStepDecl,
  isTryStmt,
  isTypeDecl,
  isValueImport,
} from "@venn-lang/core";
import type { SemanticTokenAcceptor } from "langium/lsp";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver";

// §23: `keyword.declaration` is the LSP `keyword` type plus the `declaration`
// modifier, for the words that introduce a name. The rest are plain keywords.
const DECLARING = new Set(["module", "use", "import", "fn", "deco", "fragment", "type"]);

/** Emit a keyword token for each literal keyword this node owns. */
export function highlightKeywords(node: AstNode, acceptor: SemanticTokenAcceptor): void {
  for (const word of keywordsOf(node)) {
    acceptor({
      node,
      keyword: word,
      type: SemanticTokenTypes.keyword,
      modifier: DECLARING.has(word) ? SemanticTokenModifiers.declaration : [],
    });
  }
}

function keywordsOf(node: AstNode): string[] {
  return declarations(node) ?? bindings(node) ?? control(node) ?? [];
}

function declarations(node: AstNode): string[] | undefined {
  if (isDocument(node)) return node.name ? ["module"] : [];
  if (isValueImport(node)) return ["import", "from"];
  if (isFlowDecl(node)) return ["flow"];
  if (isFragmentDecl(node)) return ["fragment"];
  if (isFnDecl(node)) return ["fn", "return"];
  if (isDecoDecl(node)) return ["deco"];
  if (isTypeDecl(node)) return ["type"];
  if (isFactoryDecl(node)) return ["factory"];
  if (isDatasetDecl(node)) return ["dataset"];
  return undefined;
}

function bindings(node: AstNode): string[] | undefined {
  if (isConfigDecl(node)) return ["config"];
  if (isMatrixDecl(node)) return ["matrix"];
  if (isReportDecl(node)) return ["report"];
  if (isLetStmt(node)) return [node.kind];
  if (isCaptureStmt(node)) return node.opts ? ["capture"] : ["capture"];
  if (isRunStmt(node)) return node.bind ? ["run", "as"] : ["run"];
  if (isExpectStmt(node)) return expectWords(node.modifier, node.negate);
  return undefined;
}

function control(node: AstNode): string[] | undefined {
  if (isStepDecl(node)) return ["step"];
  if (isGroupDecl(node)) return ["group"];
  if (isIfStmt(node)) return node.otherwise ? ["if", "else"] : ["if"];
  if (isForEachStmt(node)) return ["forEach", "in"];
  if (isRepeatStmt(node)) return node.index ? ["repeat", "as"] : ["repeat"];
  if (isLoopStmt(node)) return ["loop"];
  if (isParallelStmt(node)) return ["parallel"];
  if (isRaceStmt(node)) return ["race"];
  if (isTryStmt(node)) return tryWords(node.handler, node.finalizer);
  if (isLifecycleDecl(node)) return [node.hook ?? "on"];
  return loops(node);
}

function loops(node: AstNode): string[] | undefined {
  if (isReturnStmt(node)) return ["return"];
  if (isBreakStmt(node)) return ["break"];
  if (isContinueStmt(node)) return ["continue"];
  return undefined;
}

function expectWords(modifier: string | undefined, negate: boolean | undefined): string[] {
  const words = ["expect"];
  if (modifier) words.push(modifier);
  if (negate) words.push("not");
  return words;
}

function tryWords(handler: unknown, finalizer: unknown): string[] {
  const words = ["try"];
  if (handler) words.push("catch");
  if (finalizer) words.push("finally");
  return words;
}
