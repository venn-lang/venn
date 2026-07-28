import { type Document, isLetStmt, isUseDecl } from "@venn-lang/core";
import type { Registry } from "../registry/index.js";

/**
 * The namespaces this file actually brought in with `use`: the alias when one
 * was given, otherwise the namespace the package contributes. A name outside
 * this set was never imported, however well the registry knows it.
 */
export function collectNamespaces(document: Document, registry: Registry): Set<string> {
  const names = new Set<string>();
  for (const decl of document.imports) {
    if (!isUseDecl(decl)) continue;
    const bound = decl.alias ?? registry.namespaceOf(decl.pkg);
    if (bound) names.add(bound);
  }
  return names;
}

/**
 * The names this file binds at the top level.
 *
 * `page.click()` reads like a namespace and a verb, and is neither: it is a
 * method on something the file holds. The registry has no schema for it, so it
 * is known here and verified nowhere, which beats reporting it as an unknown
 * action it plainly is not.
 */
export function collectBoundNames(document: Document): Set<string> {
  const names = new Set<string>();
  for (const decl of document.decls) {
    if (isLetStmt(decl)) names.add(decl.name);
  }
  return names;
}

/** `use "venn/http" as h` → `{ h → "http" }`, resolved through the registry. */
export function collectAliases(document: Document, registry: Registry): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const decl of document.imports) {
    if (!isUseDecl(decl) || !decl.alias) continue;
    const namespace = registry.namespaceOf(decl.pkg);
    if (namespace) aliases.set(decl.alias, namespace);
  }
  return aliases;
}
