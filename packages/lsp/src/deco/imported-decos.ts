import { type Document, type ImportedDeco, isDecoDecl, isValueImport } from "@venn-lang/core";
import type { LangiumDocuments, URI } from "langium";
import { documentRoot } from "../document/index.js";
import type { ImportResolver } from "../workspace/index.js";

/** What is needed to read a neighbour without waiting for it to load. */
export interface ImportedDecoScope {
  root: Document;
  uri: URI;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/**
 * The `pub deco`s this file's imports reach, read straight out of the index.
 *
 * The whole graph, and every `pub deco` on it, which is exactly what the CLI
 * hands the same check: `resolveImports` collects them from each file it parses
 * without asking which of them the importer happened to name. Matching one
 * level of imports against a neighbour's declarations missed two shapes the CLI
 * accepts, and the editor drew VN2018 over a parameter `venn check` was happy
 * with: a `pub import` re-export sits in a file's `imports` and never in its
 * `decls`, and a wildcard import names nothing at all. The `mod.vn` re-export
 * is the documented folder interface, so it is the shape a reader writes first.
 *
 * Synchronous on purpose: the checker runs on every keystroke and cannot await
 * a file load. A neighbour the workspace has not indexed yet contributes
 * nothing this pass and is picked up by the next build, which is a moment of
 * silence rather than a wrong answer.
 *
 * @param scope The file being checked, and the workspace to read around it.
 * @returns Each reachable `pub deco` by the name an `@` writes, with its file.
 */
export function importedDecos(scope: ImportedDecoScope): Map<string, ImportedDeco> {
  const found = new Map<string, ImportedDeco>();
  const seen = new Set([scope.uri.toString()]);
  reach({ scope, root: scope.root, from: scope.uri, seen, found });
  return found;
}

/** One hop of the walk: where it is, and what it has already been through. */
interface Reach {
  scope: ImportedDecoScope;
  root: Document;
  from: URI;
  seen: Set<string>;
  found: Map<string, ImportedDeco>;
}

/**
 * Every file this one imports, and every file those import, once each.
 *
 * A file already walked is skipped rather than followed again, so two files
 * importing the same third cost one pass and a cycle ends instead of looping.
 */
function reach(args: Reach): void {
  for (const decl of args.root.imports) {
    if (!isValueImport(decl)) continue;
    const uri = args.scope.imports.resolve(decl.path, args.from);
    const key = uri.toString();
    if (args.seen.has(key)) continue;
    args.seen.add(key);
    const document = args.scope.documents.getDocument(uri);
    const root = document && documentRoot(document);
    if (!root) continue;
    collect(root, key, args.found);
    reach({ ...args, root, from: uri });
  }
}

/** Only what the other file marked `pub`, which is all one file hands over. */
function collect(root: Document, uri: string, found: Map<string, ImportedDeco>): void {
  for (const decl of root.decls) {
    if (isDecoDecl(decl) && decl.export) found.set(decl.name, { decl, uri });
  }
}
