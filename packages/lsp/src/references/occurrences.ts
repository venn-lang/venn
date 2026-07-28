import {
  type AstNode,
  type Document,
  isAnnotation,
  isDecoDecl,
  isFnDecl,
  isFragmentDecl,
  isNamedType,
  isRef,
  isRunStmt,
  isTypeDecl,
  isValueImport,
  walkAst,
} from "@venn/core";
import { findBinding } from "../document/index.js";
import { nameProperty } from "./name-property.js";
import type { FoundSymbol, Occurrence } from "./symbol.types.js";

/**
 * Every place one symbol appears in one document.
 *
 * One walk, one answer, whatever the caller wants it for: "find all references"
 * shows them, the editor highlights them, and rename rewrites them. Three
 * separate readings of the tree would be three chances to disagree.
 */
export function occurrencesIn(args: { root: Document; symbol: FoundSymbol }): Occurrence[] {
  const found = importNames(args.root, args.symbol.name);
  for (const node of walkAst(args.root)) {
    const one = occurrenceAt({ node, symbol: args.symbol });
    if (one) found.push(one);
  }
  return found;
}

function occurrenceAt(args: { node: AstNode; symbol: FoundSymbol }): Occurrence | undefined {
  const { node, symbol } = args;
  if (symbol.kind === "binding") return bindingUse(node, symbol);
  if (symbol.kind === "type") return typeUse(node, symbol.name);
  if (symbol.kind === "deco") return decoUse(node, symbol.name);
  if (symbol.kind === "fragment") return fragmentUse(node, symbol.name);
  if (symbol.kind === "fn") return fnUse(node, symbol.name);
  return externalUse(node, symbol.name);
}

/**
 * A name this file imported: found wherever a name of any importable kind can
 * appear.
 *
 * Which of the three it is (fragment, function or decorator) is written in the
 * file it came from, and this is asked of every file in the workspace, one of
 * which is that one. Matching all three shapes reaches it without reading
 * ahead, and no shape can match a name that is not this one.
 */
function externalUse(node: AstNode, name: string): Occurrence | undefined {
  return fnUse(node, name) ?? fragmentUse(node, name) ?? decoUse(node, name);
}

/** `import { a, b }`: one node holding several names, so each is found by index. */
function importNames(root: Document, name: string): Occurrence[] {
  const found: Occurrence[] = [];
  for (const decl of root.imports) {
    if (!isValueImport(decl)) continue;
    decl.names.forEach((each, index) => {
      if (each === name) found.push({ node: decl, property: "names", index, declaration: false });
    });
  }
  return found;
}

function fragmentUse(node: AstNode, name: string): Occurrence | undefined {
  if (isFragmentDecl(node) && node.name === name) return declaration(node);
  if (isRunStmt(node) && node.target === name) {
    return { node, property: "target", declaration: false };
  }
  return undefined;
}

function decoUse(node: AstNode, name: string): Occurrence | undefined {
  if (isDecoDecl(node) && node.name === name) return declaration(node);
  if (isAnnotation(node) && node.name === name) {
    return { node, property: "name", declaration: false };
  }
  return undefined;
}

/**
 * A function: where it is declared, and every name that reads it.
 *
 * Matched by name rather than by resolving each reference back to the
 * declaration, because a `pub fn` is read in files that never declared it: the
 * file next door holds the same name and means the same thing.
 */
function fnUse(node: AstNode, name: string): Occurrence | undefined {
  if (isFnDecl(node) && node.name === name) return declaration(node);
  if (isRef(node) && node.name === name) return { node, property: "name", declaration: false };
  return undefined;
}

function typeUse(node: AstNode, name: string): Occurrence | undefined {
  if (isTypeDecl(node) && node.name === name) return declaration(node);
  if (isNamedType(node) && node.name === name) {
    return { node, property: "name", declaration: false };
  }
  return undefined;
}

/**
 * A binding, and only the reads that resolve back to this one.
 *
 * A name shadowed in an inner block is a different binding wearing the same
 * spelling, and reporting it would send the reader to a line that has nothing
 * to do with what they asked about.
 */
function bindingUse(node: AstNode, symbol: FoundSymbol): Occurrence | undefined {
  if (node === symbol.binding) return declaration(node);
  if (!isRef(node) || node.name !== symbol.name) return undefined;
  if (findBinding(node, symbol.name) !== symbol.binding) return undefined;
  return { node, property: "name", declaration: false };
}

function declaration(node: AstNode): Occurrence | undefined {
  const property = nameProperty(node);
  return property ? { node, property, declaration: true } : undefined;
}
