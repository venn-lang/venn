import { type AstNode, showType, type Type } from "@venn-lang/core";
import type { CompletionItem, Range } from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import type { ScopedName } from "../document/index.js";
import type { ShownArg } from "../signature/index.js";
import { ICON, iconForOrigin } from "./icons.js";
import { item } from "./items.js";

export interface ArgumentItemsArgs {
  names: readonly ScopedName[];
  types: ReadonlyMap<AstNode, Type>;
  /** The argument being written, when the verb said what it takes. */
  expects: ShownArg | undefined;
  catalog: SymbolCatalog;
  range: Range;
}

/**
 * What can go here, most likely first.
 *
 * An argument almost always wants something the program already has: the server
 * two lines up, the parameter of the enclosing function. Offering the loaded
 * namespaces first, as a fresh statement would, buries the one answer under
 * dozens that cannot be right.
 */
export function argumentItems(args: ArgumentItemsArgs): CompletionItem[] {
  const values = args.names.map((each) => valueItem(each, args));
  const namespaces = args.catalog.namespaces().map((name) => nsItem(name, args.range));
  return [...values, ...namespaces];
}

/**
 * The names a program holds, offered where no type is expected of them.
 *
 * The start of a statement is such a place: nothing says what should go there,
 * so nothing can be ranked as fitting, only drawn for what it is.
 */
export function boundItems(names: readonly ScopedName[], range: Range): CompletionItem[] {
  return names.map((scoped) => ({
    ...item({
      label: scoped.name,
      kind: iconForOrigin(scoped.origin),
      range,
      detail: scoped.origin,
    }),
    sortText: `0${scoped.name}`,
  }));
}

function valueItem(scoped: ScopedName, args: ArgumentItemsArgs): CompletionItem {
  const type = args.types.get(scoped.node);
  const shown = type ? showType(type) : undefined;
  return {
    ...item({
      label: scoped.name,
      kind: iconForOrigin(scoped.origin),
      range: args.range,
      detail: shown ? `${scoped.origin} ${scoped.name}: ${shown}` : scoped.origin,
    }),
    sortText: `${fits(shown, args.expects) ? "0" : "1"}${scoped.name}`,
  };
}

function nsItem(name: string, range: Range): CompletionItem {
  return {
    ...item({ label: name, kind: ICON.namespace, range }),
    sortText: `2${name}`,
  };
}

/**
 * Whether a value is the kind of thing this argument wants. Compared as the two
 * read, not by unification: the checker's types carry inference variables that
 * matching would have to bind, and ranking a list must not change what a
 * program means.
 */
function fits(shown: string | undefined, expects: ShownArg | undefined): boolean {
  if (!shown || !expects) return false;
  if (shown === expects.type) return true;
  return expects.type.startsWith("fn(") && shown.startsWith("fn(");
}
