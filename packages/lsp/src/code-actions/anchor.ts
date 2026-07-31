import { type Document, type ImportDecl, isValueImport } from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { Position, TextEdit } from "vscode-languageserver";

/** One group, since everything a file brings in is an `import`. */
export type HeaderKind = "import";

/** Insert a header line after the last one already written. */
export function headerEdit(document: LangiumDocument, line: string): TextEdit {
  const position = anchor(document);
  return { range: { start: position, end: position }, newText: `${line}\n` };
}

function anchor(document: LangiumDocument): Position {
  const root = document.parseResult?.value as Document | undefined;
  const imports = root?.imports ?? [];
  const preferred = last(imports, isValueImport);
  const end = endOf(preferred) ?? moduleEnd(root);
  if (end === undefined) return { line: 0, character: 0 };
  return { line: document.textDocument.positionAt(end).line + 1, character: 0 };
}

function last(
  imports: readonly ImportDecl[],
  is: (node: ImportDecl) => boolean,
): ImportDecl | undefined {
  return [...imports].reverse().find((decl) => is(decl));
}

function endOf(decl: ImportDecl | undefined): number | undefined {
  const cst = decl?.$cstNode;
  return cst ? cst.offset + cst.length : undefined;
}

function moduleEnd(root: Document | undefined): number | undefined {
  if (!root?.name || !root.$cstNode) return undefined;
  const newline = root.$cstNode.text.indexOf("\n");
  return newline < 0 ? undefined : root.$cstNode.offset + newline;
}

/** True when the file already has an `import` naming this module path. */
export function alreadyImports(document: LangiumDocument, path: string): boolean {
  const root = document.parseResult?.value as Document | undefined;
  return (root?.imports ?? []).some((decl) => isValueImport(decl) && decl.path === path);
}
