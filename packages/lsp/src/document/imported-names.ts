import { type Document, isValueImport, type ValueImport } from "@venn-lang/core";

/** The names a document pulls in via `import { a, b } from "…"`. */
export function importedNames(document: Document): string[] {
  const names: string[] = [];
  for (const decl of document.imports) {
    if (isValueImport(decl)) names.push(...namesOf(decl));
  }
  return names;
}

/** The name this file knows it by, which is the alias when one was written. */
function namesOf(decl: ValueImport): string[] {
  if (decl.names.length > 0) return decl.names.map((one) => one.alias ?? one.name);
  return decl.default ? [decl.default] : [];
}
