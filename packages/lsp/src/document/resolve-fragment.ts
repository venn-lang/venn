import { type Document, type FragmentDecl, isValueImport } from "@venn-lang/core";
import type { LangiumDocument, LangiumDocuments, URI } from "langium";
import type { ImportResolver } from "../workspace/index.js";
import { findFragment } from "./find-binding.js";

/** Where a fragment lives. `decl` is absent when the file could not be read. */
export interface FragmentLocation {
  uri: URI;
  decl?: FragmentDecl;
  document?: LangiumDocument;
}

export interface ResolveFragmentArgs {
  name: string;
  document: LangiumDocument;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/** Find a fragment: declared in this file, or followed through the `import` naming it. */
export async function resolveFragment(
  args: ResolveFragmentArgs,
): Promise<FragmentLocation | undefined> {
  const root = args.document.parseResult?.value as Document | undefined;
  if (!root) return undefined;
  const local = findFragment(root, args.name);
  if (local) return { uri: args.document.uri, decl: local, document: args.document };
  const decl = root.imports.find(
    (node) =>
      isValueImport(node) && node.names.some((one) => (one.alias ?? one.name) === args.name),
  );
  return isValueImport(decl) ? fromImport(decl.path, args) : undefined;
}

async function fromImport(path: string, args: ResolveFragmentArgs): Promise<FragmentLocation> {
  const uri = args.imports.resolve(path, args.document.uri);
  const document = await args.documents.getOrCreateDocument(uri).catch(() => undefined);
  const root = document?.parseResult?.value as Document | undefined;
  const decl = root ? findFragment(root, args.name) : undefined;
  return { uri, decl, document };
}
