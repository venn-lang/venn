import { type Document, isFragmentDecl, isValueImport } from "@venn-lang/core";
import { type LangiumDocument, type LangiumDocuments, URI } from "langium";
import type { ImportResolver } from "../workspace/index.js";

export interface ModuleGraphScope {
  root: Document;
  uri: URI;
  documents: LangiumDocuments;
  imports: ImportResolver;
}

/** The files an import graph reaches, and how one names another. */
export interface ModuleGraph {
  modules: ReadonlyMap<string, Document>;
  resolve: (from: string, spec: string) => string;
}

/**
 * Every module this file reaches, read straight out of the workspace index.
 *
 * Synchronous on purpose, for the same reason the decorators are: the checker
 * runs on every keystroke and cannot await a file load. A neighbour the
 * workspace has not indexed yet contributes nothing this pass and is picked up
 * on the next, which is a moment of silence rather than a wrong answer.
 *
 * Walked transitively, because a `pub fn` that calls another file has the
 * signature it really has only once that file has been read too.
 */
export function importedModules(scope: ModuleGraphScope): ModuleGraph {
  const modules = new Map<string, Document>();
  const resolve = (from: string, spec: string): string =>
    scope.imports.resolve(spec, URI.parse(from)).toString();
  walk({ document: scope.root, uri: scope.uri.toString(), modules, resolve, scope });
  return { modules, resolve };
}

interface WalkArgs {
  document: Document;
  uri: string;
  modules: Map<string, Document>;
  resolve: (from: string, spec: string) => string;
  scope: ModuleGraphScope;
}

function walk(args: WalkArgs): void {
  for (const decl of args.document.imports) {
    if (!isValueImport(decl)) continue;
    const target = args.resolve(args.uri, decl.path);
    if (args.modules.has(target)) continue;
    const root = rootAt(target, args.scope);
    if (!root) continue;
    args.modules.set(target, root);
    walk({ ...args, document: root, uri: target });
  }
}

function rootAt(uri: string, scope: ModuleGraphScope): Document | undefined {
  const document = scope.documents.getDocument(URI.parse(uri));
  return document && rootOf(document);
}

function rootOf(document: LangiumDocument): Document | undefined {
  return document.parseResult?.value as Document | undefined;
}

/**
 * Which of the names a file imports are fragments.
 *
 * The answer comes from what the neighbouring files declare, never from the
 * import list alone: `run` accepts only a fragment, and a `pub fn` is not one.
 */
export function importedFragments(args: {
  document: Document;
  uri: string;
  graph: ModuleGraph;
}): Set<string> {
  const found = new Set<string>();
  for (const decl of args.document.imports) {
    if (!isValueImport(decl)) continue;
    const module = args.graph.modules.get(args.graph.resolve(args.uri, decl.path));
    if (!module) continue;
    for (const name of decl.names) {
      if (declaresFragment(module, name)) found.add(name);
    }
  }
  return found;
}

function declaresFragment(module: Document, name: string): boolean {
  return module.decls.some((decl) => isFragmentDecl(decl) && decl.export && decl.name === name);
}
