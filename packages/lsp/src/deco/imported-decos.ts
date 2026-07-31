import { type Document, type ImportedDeco, isDecoDecl, isValueImport } from "@venn-lang/core";
import type { LangiumDocument, LangiumDocuments, URI } from "langium";
import type { ImportResolver } from "../workspace/index.js";

/** What is needed to read a neighbour without waiting for it to load. */
export interface ImportedDecoScope {
  root: Document;
  uri: URI;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/**
 * The `pub deco`s this file imports, read straight out of the workspace index.
 *
 * Synchronous on purpose: the checker runs on every keystroke and cannot await
 * a file load. A neighbour the workspace has not indexed yet contributes
 * nothing this pass and is picked up by the next build, which is a moment of
 * silence rather than a wrong answer.
 */
export function importedDecos(scope: ImportedDecoScope): Map<string, ImportedDeco> {
  const found = new Map<string, ImportedDeco>();
  for (const decl of scope.root.imports) {
    if (isValueImport(decl))
      collect({ scope, spec: decl.path, names: decl.names.map((one) => one.name), found });
  }
  return found;
}

function collect(args: {
  scope: ImportedDecoScope;
  spec: string;
  names: readonly string[];
  found: Map<string, ImportedDeco>;
}): void {
  const uri = args.scope.imports.resolve(args.spec, args.scope.uri);
  const document = args.scope.documents.getDocument(uri);
  const root = document && rootOf(document);
  if (!root) return;
  // Only what the other file marked `pub`, and only the names this one asked for.
  for (const decl of root.decls) {
    if (isDecoDecl(decl) && decl.export && args.names.includes(decl.name)) {
      args.found.set(decl.name, { decl, uri: uri.toString() });
    }
  }
}

function rootOf(document: LangiumDocument): Document | undefined {
  return document.parseResult?.value as Document | undefined;
}
