import type { TypeSpec } from "@venn-lang/types";
import type { Document, ImportName } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { handedOn, isPackageSpecifier } from "../module/index.js";
import type { TypeCatalog } from "./catalog.types.js";
import { checkTypes } from "./check-types.js";
import { createContext } from "./context.js";
import { collectNamedTypes } from "./named-types.js";
import type { Scheme } from "./scheme.js";
import { type ResolveRef, specToType } from "./spec-to-type.js";
import { DYNAMIC, record, type Type } from "./type.types.js";

/** What the names a file imported turned out to be, ready to bind in its env. */
export type ImportedTypes = ReadonlyMap<string, ImportedType>;

/**
 * What a name imported from another file is.
 *
 * A type, or a generic still waiting for the arguments a use site writes. The
 * second cannot be a `Type`: filling its parameters with fresh variables to fit
 * would make `Box<string>` accept anything, which is what it did before this
 * was told apart.
 */
export type ImportedType = Type | { readonly generic: Scheme };

/** Whether this is a generic waiting for its arguments. */
export function isGenericImport(one: ImportedType): one is { readonly generic: Scheme } {
  return "generic" in one;
}

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
  done: Map<string, Map<string, ImportedType>>;
  busy: Set<string>;
}

/** What each name a document imports binds to, following `import { … }` and `* as`. */
function bindingsOf(args: {
  document: Document;
  uri: string;
  state: State;
}): Map<string, ImportedType> {
  const out = new Map<string, ImportedType>();
  for (const decl of args.document.imports) {
    if (!ast.isValueImport(decl)) continue;
    const published = isPackageSpecifier(decl.path)
      ? packageTypes(decl.path, args.state)
      : publishedBy(args.state.resolve(args.uri, decl.path), args.state);
    // A module nobody could read publishes nothing *known*, which is not the
    // same as publishing nothing. Typing it as an empty shape puts a second
    // error on every use of it, blaming the field for the path.
    if (decl.wildcard) {
      out.set(decl.wildcard, reached(decl.path, args) ? record(shapes(published)) : DYNAMIC);
    } else for (const one of decl.names) take(out, published, one);
  }
  return out;
}

/** Whether the file behind this specifier was reached at all. */
function reached(spec: string, args: { uri: string; state: State }): boolean {
  if (isPackageSpecifier(spec)) return true;
  return args.state.modules.has(args.state.resolve(args.uri, spec));
}

/**
 * The ones with a shape, for a namespace that gathers a whole module.
 *
 * A generic has none until a use site fills it, and `ns.Box` is not how one is
 * written anyway: it is written `Box<string>`, after being imported by name.
 */
function shapes(published: ReadonlyMap<string, ImportedType>): Map<string, Type> {
  const out = new Map<string, Type>();
  for (const [name, one] of published) if (!isGenericImport(one)) out.set(name, one);
  return out;
}

/** `import { total as sum }` binds `sum` to what the other file calls `total`. */
function take(
  out: Map<string, ImportedType>,
  published: ReadonlyMap<string, ImportedType>,
  one: ImportName,
): void {
  const found = published.get(one.name);
  if (found) out.set(one.alias ?? one.name, found);
}

/**
 * What an installed package publishes, as this language's types.
 *
 * Derived elsewhere, by whoever can read a `.d.ts`, and handed over already
 * converted, so the checker stays a checker and never learns what npm is.
 */
function packageTypes(spec: string, state: State): ReadonlyMap<string, ImportedType> {
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
function publishedBy(uri: string, state: State): ReadonlyMap<string, ImportedType> {
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

/**
 * What one module publishes, by name.
 *
 * A function and a binding publish the type of what they are, read off the check
 * of that module. A `pub type` publishes the shape it declares, which is a name
 * the checker resolves rather than a value: it goes in the same map, since a name
 * imported from a file is one thing whichever side of the language it is used on.
 */
function exportedTypes(module: Document, uri: string, state: State): Map<string, ImportedType> {
  const imports = bindingsOf({ document: module, uri, state });
  const checked = checkTypes(module, { uri, catalog: state.catalog, imports });
  const out = new Map<string, ImportedType>();
  const named = collectNamedTypes(module, createContext(), state.catalog, imports);
  for (const decl of module.decls) {
    if (!published(decl)) continue;
    const generic = ast.isTypeDecl(decl) ? named.generic?.(decl.name) : undefined;
    if (generic) {
      out.set(decl.name, { generic });
      continue;
    }
    const found = ast.isTypeDecl(decl) ? named.get(decl.name) : checked.types.get(decl);
    if (found) out.set(decl.name, found);
  }
  // A `pub import` hands on what this file's own import bound, so its type is
  // one already worked out above rather than one to derive again.
  for (const decl of module.imports) {
    if (!ast.isValueImport(decl) || !decl.export) continue;
    for (const name of handedOn(decl)) {
      const found = imports.get(name);
      if (found) out.set(name, found);
    }
  }
  return out;
}

/** A declaration this module offered, whatever kind it is. */
function published(decl: unknown): decl is { name: string } {
  const kind = decl as { export?: boolean };
  if (!kind.export) return false;
  return (
    ast.isFnDecl(decl) || ast.isTypeDecl(decl) || ast.isLetStmt(decl) || ast.isNamespaceDecl(decl)
  );
}
