import { type Document, isValueImport, type ValueImport } from "@venn/core";

/** The names a document pulls in via `import { a, b } from "…"`. */
export function importedNames(document: Document): string[] {
  const names: string[] = [];
  for (const decl of document.imports) {
    if (isValueImport(decl)) names.push(...namesOf(decl));
  }
  return names;
}

function namesOf(decl: ValueImport): string[] {
  if (decl.names.length > 0) return decl.names;
  return decl.default ? [decl.default] : [];
}
