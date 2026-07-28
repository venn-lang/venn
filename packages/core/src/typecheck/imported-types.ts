import type { TypeSpec } from "@venn-lang/types";
import type { Document } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { isPackageSpecifier } from "../module/index.js";
import type { TypeCatalog } from "./catalog.types.js";
import { checkTypes } from "./check-types.js";
import { type ResolveRef, specToType } from "./spec-to-type.js";
import { record, type Type } from "./type.types.js";

/** What the names a file imported turned out to be, ready to bind in its env. */
export type ImportedTypes = ReadonlyMap<string, Type>;

export interface ImportedTypesArgs {
  document: Document;
  uri: string;
  /** Every module the import graph reached, already parsed, by resolved URI. */
  modules: ReadonlyMap<string, Document>;
  /** How a specifier written in one file names another. */
  resolve: (from: string, spec: string) => string;
  catalog?: TypeCatalog;
  /**
   * What each installed package publishes, derived from its `.d.ts`.
   *
   * Keyed by the specifier as written, because that is what the import says.
   * Absent for a host that has not derived any, which is every run in an editor
   * that has not installed anything yet.
   */
  packages?: ReadonlyMap<string, Record<string, TypeSpec>>;
}

/**
 * The types of the names a document imports, worked out from the files it names.
 *
 * Each module is checked on its own, with *its* imports resolved first, so a
 * `pub fn` that calls another file has the signature it really has. That is what
 * lets `triplo("texto")` be refused against a `fn(number) -> number` declared
 * one file away.
 *
 * @returns a type per imported name. A name whose module publishes nothing for
 * it is simply absent, and the checker treats it as `dynamic`.
 */
export function importedTypes(args: ImportedTypesArgs): ImportedTypes {
  const state: State = {
    modules: args.modules,
    resolve: args.resolve,
    catalog: args.catalog,
    packages: args.packages,
    done: new Map(),
    busy: new Set([args.uri]),
  };
  return bindingsOf({ document: args.document, uri: args.uri, state });
}

interface State {
  modules: ReadonlyMap<string, Document>;
  resolve: (from: string, spec: string) => string;
  catalog?: TypeCatalog;
  packages?: ReadonlyMap<string, Record<string, TypeSpec>>;
  done: Map<string, Map<string, Type>>;
  busy: Set<string>;
}

/** What each name a document imports binds to, following `import { … }` and `* as`. */
function bindingsOf(args: { document: Document; uri: string; state: State }): Map<string, Type> {
  const out = new Map<string, Type>();
  for (const decl of args.document.imports) {
    if (!ast.isValueImport(decl)) continue;
    const published = isPackageSpecifier(decl.path)
      ? packageTypes(decl.path, args.state)
      : publishedBy(args.state.resolve(args.uri, decl.path), args.state);
    if (decl.wildcard) out.set(decl.wildcard, record(published));
    else for (const name of decl.names) take(out, published, name);
  }
  return out;
}

function take(out: Map<string, Type>, published: ReadonlyMap<string, Type>, name: string): void {
  const found = published.get(name);
  if (found) out.set(name, found);
}

/**
 * What an installed package publishes, as this language's types.
 *
 * Derived elsewhere, by whoever can read a `.d.ts`, and handed over already
 * converted, so the checker stays a checker and never learns what npm is.
 */
function packageTypes(spec: string, state: State): ReadonlyMap<string, Type> {
  const found = state.packages?.get(spec);
  if (!found) return new Map();
  // A package's types name nothing of this language's, so a reference in one is
  // a name from a `.d.ts` that did not survive the conversion: `dynamic`.
  const unknown: ResolveRef = () => undefined;
  return new Map(Object.entries(found).map(([name, one]) => [name, specToType(one, unknown)]));
}

/**
 * The types a module publishes, checked once.
 *
 * A module already being checked answers with nothing rather than looping: two
 * files that call each other cannot both be inferred from the other, and the
 * honest answer for the second is that its signature is not yet known. Whatever
 * it declared outright is still read on its own next time round.
 */
function publishedBy(uri: string, state: State): ReadonlyMap<string, Type> {
  const cached = state.done.get(uri);
  if (cached) return cached;
  const module = state.modules.get(uri);
  if (!module || state.busy.has(uri)) return new Map();
  state.busy.add(uri);
  const out = exportedTypes(module, uri, state);
  state.busy.delete(uri);
  state.done.set(uri, out);
  return out;
}

function exportedTypes(module: Document, uri: string, state: State): Map<string, Type> {
  const imports = bindingsOf({ document: module, uri, state });
  const checked = checkTypes(module, { uri, catalog: state.catalog, imports });
  const out = new Map<string, Type>();
  for (const decl of module.decls) {
    if (!ast.isFnDecl(decl) || !decl.export) continue;
    const found = checked.types.get(decl);
    if (found) out.set(decl.name, found);
  }
  return out;
}
