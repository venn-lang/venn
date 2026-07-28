import {
  type AstNode,
  isAnnotation,
  isCaptureStmt,
  isDatasetDecl,
  isDecoDecl,
  isDocument,
  isFnDecl,
  isForEachStmt,
  isFragmentDecl,
  isLetStmt,
  isNamedType,
  isParam,
  isRef,
  isRepeatStmt,
  isRunStmt,
  isTypeDecl,
  isValueImport,
} from "@venn-lang/core";
import { AstUtils, type CstNode, CstUtils, type LangiumDocument } from "langium";
import type { Position } from "vscode-languageserver";
import { findBinding } from "../document/index.js";
import { nameProperty } from "./name-property.js";
import type { FoundSymbol } from "./symbol.types.js";

/**
 * The symbol a position names, or nothing when it names none.
 *
 * Read from the token under the cursor rather than from the node containing it:
 * one node often carries two names (`import { a, b }` is a single node, and so
 * is `run login("x")`), and the answer depends on which word was clicked.
 */
export function symbolAt(document: LangiumDocument, position: Position): FoundSymbol | undefined {
  const leaf = leafAt(document, position);
  if (!leaf) return undefined;
  return declared(leaf) ?? used(leaf);
}

export function leafAt(document: LangiumDocument, position: Position): CstNode | undefined {
  const root = document.parseResult?.value?.$cstNode;
  const offset = document.textDocument.offsetAt(position);
  return root ? CstUtils.findLeafNodeAtOffset(root, offset) : undefined;
}

/** The cursor is on the word that introduces the name. */
function declared(leaf: CstNode): FoundSymbol | undefined {
  const node = leaf.astNode;
  const name = leaf.text;
  if (isFragmentDecl(node) && node.name === name) return { kind: "fragment", name };
  if (isDecoDecl(node) && node.name === name) return { kind: "deco", name };
  if (isFnDecl(node) && node.name === name) return { kind: "fn", name };
  if (isTypeDecl(node) && node.name === name) return { kind: "type", name, binding: node };
  return declaredBinding(leaf);
}

/**
 * The cursor on the word a `const`, a parameter or a loop variable introduces.
 *
 * Told apart from a use by the node it sits on, never by the text. A `Ref` also
 * carries a `name` equal to the word under the cursor, and treating one as a
 * declaration would make the binding be itself, so no read of it would resolve.
 */
function declaredBinding(leaf: CstNode): FoundSymbol | undefined {
  const node = leaf.astNode;
  if (!binds(node)) return undefined;
  const property = nameProperty(node);
  const written = property && (node as unknown as Record<string, unknown>)[property];
  return written === leaf.text ? { kind: "binding", name: leaf.text, binding: node } : undefined;
}

function binds(node: AstNode): boolean {
  return (
    isLetStmt(node) ||
    isCaptureStmt(node) ||
    isDatasetDecl(node) ||
    isParam(node) ||
    isForEachStmt(node) ||
    isRepeatStmt(node)
  );
}

/** The cursor is on a use of the name, or on one inside an `import { … }`. */
function used(leaf: CstNode): FoundSymbol | undefined {
  const node = leaf.astNode;
  const name = leaf.text;
  if (isRunStmt(node) && node.target === name) return { kind: "fragment", name };
  if (isAnnotation(node) && node.name === name) return { kind: "deco", name };
  if (isNamedType(node) && node.name === name) return { kind: "type", name };
  if (isValueImport(node) && node.names.includes(name)) return { kind: "external", name };
  return isRef(node) && node.name === name ? boundSymbol(node, name) : undefined;
}

/**
 * A plain name: which binding it resolves to decides how far it reaches.
 *
 * A `fn` this file declared is importable, so its uses may be anywhere; a
 * `const` or a parameter is bound here and a name spelled the same next door is
 * a different name entirely.
 */
function boundSymbol(node: AstNode, name: string): FoundSymbol {
  const binding = findBinding(node, name);
  if (binding && isFnDecl(binding)) return { kind: "fn", name };
  if (binding && isFragmentDecl(binding)) return { kind: "fragment", name };
  if (binding && isDecoDecl(binding)) return { kind: "deco", name };
  // Nothing here binds it and the file imported it, so it belongs to another
  // file. Calling it a local binding would keep the search inside this one.
  if (!binding && isImported(node, name)) return { kind: "external", name };
  return { kind: "binding", name, binding };
}

function isImported(from: AstNode, name: string): boolean {
  const root = AstUtils.getContainerOfType(from, isDocument);
  return (root?.imports ?? []).some((decl) => isValueImport(decl) && decl.names.includes(name));
}
