import type { Document } from "@venn-lang/core";
import type { Registry } from "../registry/index.js";
import { readImports } from "./read-imports.js";

/**
 * What this file calls each namespace it brought in, mapped to the namespace's
 * own name.
 *
 * `import { http }` gives `{ http → "http" }` and `import { http as h }` gives
 * `{ h → "http" }`, which is what lets a verb written as `h.get` reach the
 * registry entry for `http.get`.
 *
 * @param document The file being read.
 * @param registry The plugins this run loaded.
 * @returns Local name to real namespace, for every namespace in reach here.
 */
export function namespacesInFile(document: Document, registry: Registry): Map<string, string> {
  return new Map(readImports(document, registry).namespaces);
}
