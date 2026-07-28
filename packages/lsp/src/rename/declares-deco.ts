import { type Document, isDecoDecl } from "@venn-lang/core";
import type { LangiumDocument, LangiumDocuments } from "langium";

/** Whether any open document declares a `deco` by this name. */
export function declaresDeco(documents: LangiumDocuments, name: string): boolean {
  for (const document of documents.all) {
    const decls = rootOf(document)?.decls ?? [];
    if (decls.some((decl) => isDecoDecl(decl) && decl.name === name)) return true;
  }
  return false;
}

function rootOf(document: LangiumDocument): Document | undefined {
  return document.parseResult?.value as Document | undefined;
}
