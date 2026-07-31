import {
  boundNames,
  type Document,
  type ForEachStmt,
  isForEachStmt,
  isLetStmt,
  isParam,
  patternNames,
  walkAst,
} from "@venn-lang/core";
import { namespacesInFile } from "../imports/index.js";
import type { Registry } from "../registry/index.js";

/**
 * The namespaces this file brought in, by the name it writes them under.
 *
 * A name outside this set was never imported, however well the registry knows
 * it: that is what makes the top of a file the answer to where something came
 * from. `use` is read too, until it goes.
 */
export function collectNamespaces(document: Document, registry: Registry): Set<string> {
  return new Set(namespacesInFile(document, registry).keys());
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
  for (const node of walkAst(document)) {
    if (isLetStmt(node) || isParam(node)) for (const name of boundNames(node)) names.add(name);
    else if (isForEachStmt(node)) for (const name of loopNames(node)) names.add(name);
  }
  return names;
}

/** What a `forEach` calls each item, written either as a name or as a pattern. */
function loopNames(node: ForEachStmt): string[] {
  if (node.item) return [node.item];
  return node.pattern ? patternNames(node.pattern) : [];
}

/**
 * The name each namespace is written under here, mapped back to its own.
 *
 * `import { http as h }` and `use "venn/http" as h` both give `{ h → "http" }`,
 * which is what lets a verb written as `h.get` reach the registry entry for
 * `http.get`.
 */
export function collectAliases(document: Document, registry: Registry): Map<string, string> {
  return namespacesInFile(document, registry);
}
