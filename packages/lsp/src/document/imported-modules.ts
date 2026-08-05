import { type Document, isFragmentDecl, isValueImport } from "@venn-lang/core";
import { type LangiumDocuments, URI } from "langium";
import type { ImportResolver } from "../workspace/index.js";
import { documentRoot } from "./document-root.js";
import { handsOn } from "./hands-on.js";

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
  return document && documentRoot(document);
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
    const uri = args.graph.resolve(args.uri, decl.path);
    for (const one of decl.names) {
      const at = { uri, name: one.name, graph: args.graph, seen: new Set<string>() };
      if (offersFragment(at)) found.add(one.alias ?? one.name);
    }
  }
  return found;
}

/**
 * Whether a module offers this name as a fragment, through what it hands on.
 *
 * A folder with a face declares nothing of its own, so stopping at the file an
 * import names answers no for every name behind one. `seen` is per question
 * rather than shared: two files may hand each other different names without
 * either being a cycle, and only the same name in the same file is one.
 */
function offersFragment(args: {
  uri: string;
  name: string;
  graph: ModuleGraph;
  seen: Set<string>;
}): boolean {
  const module = args.graph.modules.get(args.uri);
  if (!module || args.seen.has(args.uri)) return false;
  args.seen.add(args.uri);
  if (declaresFragment(module, args.name)) return true;
  const onward = handsOn(module, args.name);
  if (!onward) return false;
  const uri = args.graph.resolve(args.uri, onward.decl.path);
  return offersFragment({ ...args, uri, name: onward.name });
}

function declaresFragment(module: Document, name: string): boolean {
  return module.decls.some((decl) => isFragmentDecl(decl) && decl.export && decl.name === name);
}
