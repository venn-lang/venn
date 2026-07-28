import type { ActionDefinition, MatcherDefinition } from "@venn-lang/sdk";
import type { TypeSpec } from "@venn-lang/types";

/** One type a plugin publishes: `http.Request`, and the shape behind it. */
export interface TypeEntry {
  namespace: string;
  name: string;
  package: string;
  spec: TypeSpec;
}

/** One action, with the package that contributes it. */
export interface ActionEntry {
  namespace: string;
  name: string;
  package: string;
  action: ActionDefinition;
}

/** One matcher, with the package that contributes it. */
export interface MatcherEntry {
  name: string;
  package: string;
  matcher: MatcherDefinition;
}

/**
 * Everything the editor needs to resolve, list and describe stdlib symbols.
 * The grammar cannot tell `http.post` from `myHelper.foo`; this catalogue can.
 */
export interface SymbolCatalog {
  namespaces(): readonly string[];
  packages(): readonly string[];
  hasNamespace(namespace: string): boolean;
  actionsIn(namespace: string): readonly ActionEntry[];
  action(namespace: string, name: string): ActionEntry | undefined;
  /** The types that namespace publishes: what `http.` offers besides verbs. */
  typesIn(namespace: string): readonly TypeEntry[];
  matchers(): readonly MatcherEntry[];
  matcher(name: string): MatcherEntry | undefined;
  namespaceOfPackage(pkg: string): string | undefined;
  /** Every package contributing this namespace: the `use` options to offer. */
  packagesFor(namespace: string): readonly string[];
}
