import type { AstNode } from "@venn/core";

/**
 * What a name under the cursor turns out to be.
 *
 * The kinds differ in one thing that decides everything downstream: how far the
 * name reaches. A `fragment`, a `deco` and a `pub fn` cross files, so finding
 * every use means reading the workspace. A `const`, a parameter or a loop
 * variable is bound in one place in one file, and a name spelled the same
 * anywhere else is a different name: following it out of the file would report
 * strangers as references.
 */
export type SymbolKind = "fragment" | "deco" | "fn" | "type" | "binding" | "external";

export interface FoundSymbol {
  kind: SymbolKind;
  name: string;
  /**
   * The node that binds it, when the kind is file-scoped. Two `const`s of the
   * same name in one file are two symbols, and this is what tells them apart.
   */
  binding?: AstNode;
}

/** One place a name appears, named by the property of the node that holds it. */
export interface Occurrence {
  node: AstNode;
  property: string;
  /** For a list-valued property: the names inside `import { a, b }`. */
  index?: number;
  /** Whether this is where the name is introduced, rather than used. */
  declaration: boolean;
}

/** Whether a symbol's uses can be in another file at all. */
export function crossesFiles(kind: SymbolKind): boolean {
  return kind !== "binding" && kind !== "type";
}
