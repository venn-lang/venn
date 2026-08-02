import {
  type Document,
  type FragmentDecl,
  isFragmentDecl,
  isPackageSpecifier,
  isValueImport,
  publishedNames,
  type ValueImport,
} from "@venn-lang/core";
import type { Scope } from "../scope/index.js";
import { bindFunctions, bindPlainValues } from "./bind-globals.js";
import { bindDeclaredNamespaces } from "./declared-namespaces.js";
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
 *
 * @returns Where each imported fragment reads from: the scope of the file it was
 * written in, which is not the one it is `run` from.
 */
export function bindImports(args: {
  document: Document;
  uri: string;
  scope: Scope;
  graph: ImportGraph;
  /** How the scope a module is read in gets made: the same one the entry gets. */
  base: () => Scope;
}): ReadonlyMap<FragmentDecl, Scope> {
  const built = new Map<string, Scope>();
  for (const [uri, module] of args.graph.modules) {
    const scope = args.base();
    built.set(uri, scope);
    bindFunctions(module, scope);
    bindDeclaredNamespaces(module.decls, scope);
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
  return fragmentHomes(args.graph.modules, built);
}

/**
 * Every fragment a module declares, against that module's scope.
 *
 * Keyed by the declaration rather than by name, because two files may each
 * declare a `login` and each reads its own.
 */
function fragmentHomes(
  modules: ReadonlyMap<string, Document>,
  built: ReadonlyMap<string, Scope>,
): ReadonlyMap<FragmentDecl, Scope> {
  const homes = new Map<FragmentDecl, Scope>();
  for (const [uri, module] of modules) {
    const scope = built.get(uri);
    if (!scope) continue;
    for (const decl of module.decls) if (isFragmentDecl(decl)) homes.set(decl, scope);
  }
  return homes;
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
  for (const one of args.decl.names) {
    if (one.name in module) args.into.set(one.alias ?? one.name, module[one.name]);
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
  for (const one of args.decl.names) {
    if (exported.has(one.name)) args.into.set(one.alias ?? one.name, args.source.lookup(one.name));
  }
}

/** `import * as u`: one value holding everything the module published. */
function gathered(names: ReadonlySet<string>, source: Scope): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of names) out[name] = source.lookup(name);
  return out;
}

/**
 * The names a module offers, as far as the binder is concerned.
 *
 * A `pub type` is published too, and there is nothing to bind for it: a type is
 * a name the checker resolves, and reading one here finds nothing, which is
 * what a type is at run time. The same goes for a `pub import` of one, which
 * cannot be told from a `pub import` of a value without following it.
 */
function exportedValues(document: Document): Set<string> {
  return publishedNames(document);
}
