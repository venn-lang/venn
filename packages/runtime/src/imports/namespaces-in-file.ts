import { type Document, isUseDecl } from "@venn-lang/core";
import type { Registry } from "../registry/index.js";
import { readImports } from "./read-imports.js";

/**
 * What this file calls each namespace it brought in, mapped to the namespace's
 * own name.
 *
 * One answer for both spellings, so nothing downstream has to know which was
 * written: `import { http as h }` and `use "venn/http" as h` are the same fact,
 * and a plain `use` is that fact with the name left alone.
 *
 * @param document The file being read.
 * @param registry The plugins this run loaded.
 * @returns Local name to real namespace, for every namespace in reach here.
 */
export function namespacesInFile(document: Document, registry: Registry): Map<string, string> {
  const named = new Map(readImports(document, registry).namespaces);
  for (const decl of document.imports) {
    if (!isUseDecl(decl)) continue;
    const namespace = registry.namespaceOf(decl.pkg);
    if (namespace) named.set(decl.alias ?? namespace, namespace);
  }
  return named;
}
