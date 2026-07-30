import {
  boundNames,
  type Document,
  isFnDecl,
  isLetStmt,
  isPackageSpecifier,
  isValueImport,
  type ValueImport,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { bindFunctions, bindPlainValues } from "./bind-globals.js";
import { inDependencyOrder } from "./import-order.js";

/** The files an import graph reached, and how one file names another. */
export interface ImportGraph {
  modules: ReadonlyMap<string, Document>;
  resolve: (from: string, spec: string) => string;
  /** What each npm specifier loaded to, already a value. */
  npm?: ReadonlyMap<string, Record<string, unknown>>;
}

/**
 * Bind the names a document imported, each to the value its own module made.
 *
 * A `pub fn` is a closure over the file it was written in (it calls that file's
 * private helpers and reads that file's globals) so it cannot simply be lifted
 * into the importer's scope. Each module gets a scope of its own, built the same
 * way the entry document's is, and the importer takes only the names it asked
 * for out of it.
 *
 * Three passes over every module at once, not one walk per import: two files
 * that call each other are ordinary, and no single order resolves them. Filling
 * every scope first and wiring afterwards has no order to get wrong, because a
 * function captures the scope object and wiring mutates that same object.
 *
 * Call this before the document's own globals are bound, so a local name of the
 * same spelling wins. That is the rule fragments already follow.
 */
export function bindImports(args: {
  document: Document;
  uri: string;
  scope: Scope;
  graph: ImportGraph;
  /** How the scope a module is read in gets made: the same one the entry gets. */
  base: () => Scope;
}): void {
  const built = new Map<string, Scope>();
  for (const [uri, module] of args.graph.modules) {
    const scope = args.base();
    built.set(uri, scope);
    bindFunctions(module, scope);
  }
  const link = (uri: string, module: Document): void => {
    wire({ document: module, uri, into: scopeAt(built, uri), graph: args.graph, built });
  };
  // Functions across every module first, so a value that calls an imported one
  // finds it whichever file it lives in.
  for (const [uri, module] of args.graph.modules) link(uri, module);
  // Then the values, imports before importers: a `pub const` is computed where
  // it stands, so the module it reads from has to be filled already. Linked
  // again on the way past, to pick up the values that now exist.
  for (const [uri, module] of inDependencyOrder(args.graph)) {
    link(uri, module);
    bindPlainValues(module, scopeAt(built, uri));
  }
  wire({ document: args.document, uri: args.uri, into: args.scope, graph: args.graph, built });
}

function scopeAt(built: ReadonlyMap<string, Scope>, uri: string): Scope {
  return built.get(uri) as Scope;
}

interface Wiring {
  document: Document;
  uri: string;
  into: Scope;
  graph: ImportGraph;
  built: ReadonlyMap<string, Scope>;
}

function wire(args: Wiring): void {
  for (const decl of args.document.imports) {
    if (!isValueImport(decl)) continue;
    if (isPackageSpecifier(decl.path)) {
      takePackage({ decl, graph: args.graph, into: args.into });
      continue;
    }
    const from = args.graph.resolve(args.uri, decl.path);
    const module = args.graph.modules.get(from);
    const source = args.built.get(from);
    if (module && source) take({ decl, module, source, into: args.into });
  }
}

/**
 * The names an installed package published.
 *
 * Everything it exports is fair game: a package has no `pub`, its exports *are*
 * what it made public, so unlike a `.vn` module there is nothing to filter
 * against. `default` is bound too, under whichever name the import gave it,
 * because that is the only name it has here.
 */
function takePackage(args: { decl: ValueImport; graph: ImportGraph; into: Scope }): void {
  const module = args.graph.npm?.get(args.decl.path);
  if (!module) return;
  if (args.decl.wildcard) return void args.into.set(args.decl.wildcard, { ...module });
  if (args.decl.default) return void args.into.set(args.decl.default, module.default);
  for (const name of args.decl.names) {
    if (name in module) args.into.set(name, module[name]);
  }
}

function take(args: { decl: ValueImport; module: Document; source: Scope; into: Scope }): void {
  const exported = exportedValues(args.module);
  if (args.decl.wildcard) {
    args.into.set(args.decl.wildcard, gathered(exported, args.source));
    return;
  }
  // Only what the module offered. Reaching a private name would work here and
  // then stop working the day that file rearranges its own insides.
  for (const name of args.decl.names) {
    if (exported.has(name)) args.into.set(name, args.source.lookup(name));
  }
}

/** `import * as u`: one value holding everything the module published. */
function gathered(names: ReadonlySet<string>, source: Scope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) out[name] = source.lookup(name);
  return out;
}

/**
 * The names a module made `pub` that are values a caller can hold.
 *
 * A function and a binding. A `pub type` is published too, but it is a name the
 * checker resolves rather than a value anything holds at run time, so there is
 * nothing here to bind for it.
 */
function exportedValues(document: Document): Set<string> {
  const names = new Set<string>();
  for (const decl of document.decls) {
    if (isFnDecl(decl) && decl.export) names.add(decl.name);
    if (isLetStmt(decl) && decl.export) for (const name of boundNames(decl)) names.add(name);
  }
  return names;
}
