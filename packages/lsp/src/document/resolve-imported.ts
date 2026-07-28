import type { AstNode, Document, ValueImport } from "@venn/core";
import type { LangiumDocument, LangiumDocuments, URI } from "langium";
import type { ImportResolver } from "../workspace/index.js";
import { findDeclaration } from "./find-binding.js";

/** Where an imported name was declared. `decl` is absent when the file cannot be read. */
export interface ImportedLocation {
  uri: URI;
  decl?: AstNode;
  document?: LangiumDocument;
}

export interface ResolveImportedArgs {
  name: string;
  /** The `import { … } from "…"` that names it. */
  decl: ValueImport;
  document: LangiumDocument;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/**
 * Follow a name in an `import` list back to whatever declares it.
 *
 * Unlike `resolveFragment`, this does not care what kind of thing it finds: an
 * import list holds `pub fn`, `pub fragment`, `pub deco` and `pub const` side
 * by side with nothing distinguishing them, so the name is all there is to go
 * on until the other file is read.
 */
export async function resolveImported(args: ResolveImportedArgs): Promise<ImportedLocation> {
  const uri = args.imports.resolve(args.decl.path, args.document.uri);
  const document = await args.documents.getOrCreateDocument(uri).catch(() => undefined);
  const root = document?.parseResult?.value as Document | undefined;
  return { uri, decl: root ? findDeclaration(root, args.name) : undefined, document };
}
