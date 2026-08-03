import {
  type AstNode,
  type Document,
  isDecoDecl,
  isFnDecl,
  isFragmentDecl,
  isLetStmt,
  isNamespaceDecl,
  isTypeDecl,
  publishedNames,
} from "@venn-lang/core";

/** A name a module publishes, and which kind of thing it is. */
export interface ExportedName {
  name: string;
  /** `fragment`, `fn`, `deco`, `const`, `let`, `type`, `namespace` or `import`. */
  origin: string;
}

/**
 * The names a module marks `pub`: everything another file is allowed to import.
 *
 * The set comes from core, which is the one answer the binder, the type checker
 * and the import check already read. This used to work it out again and reach
 * only three of the seven ways a name gets published, so a `pub const` the
 * runtime binds and `venn check` accepts could not be completed inside
 * `import { }` and was invisible to the import quick fix.
 *
 * The kind travels with the name because the two are read together everywhere:
 * an `import { … }` list draws a fragment apart from a function, and `run`
 * accepts only one of them.
 *
 * @param document The module being read.
 * @returns One entry per published name. A name handed on by `pub import` has
 * no declaration here, so its origin is `import`.
 */
export function exportedNames(document: Document): ExportedName[] {
  const kinds = kindsIn(document);
  return [...publishedNames(document)].map((name) => ({
    name,
    origin: kinds.get(name) ?? "import",
  }));
}

/** What each name was declared as, for the ones a declaration in this file named. */
function kindsIn(document: Document): Map<string, string> {
  const found = new Map<string, string>();
  for (const decl of document.decls) {
    const named = decl as { export?: boolean; name?: string };
    if (named.export && named.name) found.set(named.name, originOf(decl));
  }
  return found;
}

function originOf(decl: AstNode): string {
  if (isFragmentDecl(decl)) return "fragment";
  if (isFnDecl(decl)) return "fn";
  if (isDecoDecl(decl)) return "deco";
  if (isTypeDecl(decl)) return "type";
  if (isNamespaceDecl(decl)) return "namespace";
  return isLetStmt(decl) ? decl.kind : "import";
}
