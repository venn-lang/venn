import {
  type AstNode,
  type Block,
  type Document,
  isDecoDecl,
  isFlowDecl,
  isFragmentDecl,
  isGroupDecl,
  isStepDecl,
} from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { DocumentSymbolProvider } from "langium/lsp";
import { type DocumentSymbol, SymbolKind } from "vscode-languageserver";

const ORIGIN = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

/** The outline: flows with their steps and groups, plus fragments and resources. */
export class VennDocumentSymbolProvider implements DocumentSymbolProvider {
  getSymbols(document: LangiumDocument): DocumentSymbol[] {
    const root = document.parseResult?.value as Document | undefined;
    return root ? root.decls.flatMap(topSymbol) : [];
  }
}

function topSymbol(decl: AstNode): DocumentSymbol[] {
  if (isFlowDecl(decl)) {
    const children = blockSymbols(decl.body);
    return [symbol({ node: decl, name: decl.title, kind: SymbolKind.Event, children })];
  }
  if (isFragmentDecl(decl)) {
    return [symbol({ node: decl, name: decl.name, kind: SymbolKind.Function })];
  }
  // A `deco` is a declaration a reader looks for by name, like a fragment.
  if (isDecoDecl(decl)) {
    return [symbol({ node: decl, name: decl.name, kind: SymbolKind.Function })];
  }
  return [];
}

function blockSymbols(block: Block): DocumentSymbol[] {
  return block.stmts.flatMap((stmt) => {
    if (isStepDecl(stmt)) {
      const children = blockSymbols(stmt.body);
      return [symbol({ node: stmt, name: stmt.title, kind: SymbolKind.Method, children })];
    }
    if (isGroupDecl(stmt)) {
      const children = blockSymbols(stmt.body);
      return [symbol({ node: stmt, name: stmt.title, kind: SymbolKind.Namespace, children })];
    }
    return [];
  });
}

function symbol(args: {
  node: AstNode;
  name: string;
  kind: SymbolKind;
  children?: DocumentSymbol[];
}): DocumentSymbol {
  const range = args.node.$cstNode?.range ?? ORIGIN;
  return {
    name: args.name,
    kind: args.kind,
    range,
    selectionRange: range,
    children: args.children,
  };
}
