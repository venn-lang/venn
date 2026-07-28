import { BUILTIN_TYPES, type Document, isTypeDecl } from "@venn/core";
import type { CompletionItem, Range } from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import { ICON } from "./icons.js";
import { item } from "./items.js";

export interface TypeNameArgs {
  root: Document | undefined;
  catalog: SymbolCatalog;
  /** Namespaces this file brought in; a type it cannot name is not offered. */
  imported: readonly string[];
  range: Range;
}

/**
 * Every type that may be written here: the language's own, the ones this file
 * declared, and the ones its imports publish, in that order.
 */
export function typeNameItems(args: TypeNameArgs): CompletionItem[] {
  return [...builtins(args.range), ...declared(args), ...published(args)];
}

function builtins(range: Range): CompletionItem[] {
  return Object.entries(BUILTIN_TYPES).map(([name, builtin]) => ({
    ...item({
      label: name,
      kind: ICON.builtinType,
      range,
      detail: "built in",
      documentation: builtin.doc,
    }),
    sortText: `0${name}`,
  }));
}

/** What this file declared with `type`. */
function declared(args: TypeNameArgs): CompletionItem[] {
  return (args.root?.decls ?? []).filter(isTypeDecl).map((decl) => ({
    ...item({
      label: decl.name,
      kind: ICON.type,
      range: args.range,
      detail: "declared here",
    }),
    sortText: `1${decl.name}`,
  }));
}

/** What the imported packages publish, written qualified, as they are used. */
function published(args: TypeNameArgs): CompletionItem[] {
  return args.imported.flatMap((namespace) =>
    args.catalog.typesIn(namespace).map((entry) => ({
      ...item({
        label: `${entry.namespace}.${entry.name}`,
        kind: ICON.type,
        range: args.range,
        detail: entry.package,
      }),
      sortText: `2${entry.namespace}.${entry.name}`,
    })),
  );
}
