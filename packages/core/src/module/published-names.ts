import type { Document, ValueImport } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import { boundNames } from "../pattern/index.js";

/**
 * Every name a module offers to whoever imports it.
 *
 * Two ways a name gets here: a declaration marked `pub`, and a `pub import`,
 * which hands on a name this file brought in from somewhere else. The second is
 * what lets a folder have a face, one file naming what the folder publishes so
 * a caller does not learn its insides.
 *
 * Asked in one place because three readers need the same answer and used to
 * work it out separately: the binder, the type checker, and the check that
 * refuses an import of a name nobody published.
 *
 * @param document The module being read.
 * @returns The names, without saying which side of the language each is on. A
 * type and a value both arrive by name, and telling them apart is the job of
 * whoever asked.
 */
export function publishedNames(document: Document): Set<string> {
  const names = new Set<string>();
  for (const decl of document.decls) for (const name of declaredNames(decl)) names.add(name);
  for (const decl of document.imports) {
    if (ast.isValueImport(decl) && decl.export) for (const name of handedOn(decl)) names.add(name);
  }
  return names;
}

/** What one `pub` declaration offers. */
function declaredNames(decl: unknown): readonly string[] {
  const marked = decl as { export?: boolean };
  if (!marked.export) return [];
  if (ast.isLetStmt(decl)) return boundNames(decl);
  if (ast.isFnDecl(decl) || ast.isFragmentDecl(decl) || ast.isDecoDecl(decl)) return [decl.name];
  if (ast.isNamespaceDecl(decl)) return [decl.name];
  return ast.isTypeDecl(decl) ? [decl.name] : [];
}

/** What a `pub import` hands on, under the name this file gave it. */
export function handedOn(decl: ValueImport): readonly string[] {
  if (decl.wildcard) return [decl.wildcard];
  if (decl.default) return [decl.default];
  return decl.names.map((one) => one.alias ?? one.name);
}
