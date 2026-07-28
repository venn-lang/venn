import { type AstNode, type Document, isDecoDecl, isFnDecl, isFragmentDecl } from "@venn/core";

/** A name a module publishes, and which kind of thing it is. */
export interface ExportedName {
  name: string;
  /** `fragment`, `fn` or `deco`: what the editor draws it as. */
  origin: string;
}

/**
 * The names a module marks `pub`: everything another file is allowed to import.
 * A `deco` crosses files like a fragment or a function does.
 *
 * The kind travels with the name because the two are read together everywhere:
 * an `import { … }` list draws a fragment apart from a function, and `run`
 * accepts only one of them.
 */
export function exportedNames(document: Document): ExportedName[] {
  const found: ExportedName[] = [];
  for (const decl of document.decls) {
    if (!isFragmentDecl(decl) && !isFnDecl(decl) && !isDecoDecl(decl)) continue;
    if (decl.export) found.push({ name: decl.name, origin: originOf(decl) });
  }
  return found;
}

function originOf(decl: AstNode): string {
  if (isFragmentDecl(decl)) return "fragment";
  return isFnDecl(decl) ? "fn" : "deco";
}
