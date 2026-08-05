import { isDecoDecl } from "@venn-lang/core";
import type { LangiumDocuments } from "langium";
import { documentRoot } from "../document/index.js";

/** Whether any open document declares a `deco` by this name. */
export function declaresDeco(documents: LangiumDocuments, name: string): boolean {
  for (const document of documents.all) {
    const decls = documentRoot(document)?.decls ?? [];
    if (decls.some((decl) => isDecoDecl(decl) && decl.name === name)) return true;
  }
  return false;
}
