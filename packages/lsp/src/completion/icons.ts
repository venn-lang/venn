import { CompletionItemKind } from "vscode-languageserver";

/**
 * One icon per kind of thing, decided in one place so the item builders cannot
 * disagree about what a published type or a bound name looks like.
 *
 * The rule the icons follow is what the reader is about to write: a `Method`
 * needs brackets, a `Property` is computed and read bare, a `Field` is data
 * sitting there. Everything else names the sort of declaration it came from.
 */
export interface IconTable {
  readonly constant: CompletionItemKind;
  readonly variable: CompletionItemKind;
  readonly callable: CompletionItemKind;
  readonly fragment: CompletionItemKind;
  readonly verb: CompletionItemKind;
  readonly matcher: CompletionItemKind;
  readonly decorator: CompletionItemKind;
  readonly namespace: CompletionItemKind;
  readonly type: CompletionItemKind;
  readonly builtinType: CompletionItemKind;
  readonly key: CompletionItemKind;
  readonly computed: CompletionItemKind;
  readonly method: CompletionItemKind;
  readonly env: CompletionItemKind;
  readonly path: CompletionItemKind;
  readonly keyword: CompletionItemKind;
}

export const ICON: IconTable = {
  /** `const x = …`: bound once, never reassigned. */
  constant: CompletionItemKind.Constant,
  /** `let x = …`, a parameter, a loop variable. */
  variable: CompletionItemKind.Variable,
  /** A `fn`: called for a value, in an expression. */
  callable: CompletionItemKind.Function,
  /**
   * A `fragment`: a named piece of a flow, invoked with `run`.
   *
   * Deliberately not the icon a function carries. A function gives back a
   * value; a fragment gives back steps that the report records and that can
   * fail. The icon has to separate them while the reader is still choosing.
   */
  fragment: CompletionItemKind.Snippet,
  /** A verb a plugin contributes: `http.get`. */
  verb: CompletionItemKind.Function,
  /** A word usable after `expect`: `contains`, `oneOf`. */
  matcher: CompletionItemKind.Function,
  /** A `deco`, applied with `@`. */
  decorator: CompletionItemKind.Function,
  /** A plugin namespace, or a package to `use`. */
  namespace: CompletionItemKind.Module,
  /** A type: declared here, published by a package, or a `type` alias. */
  type: CompletionItemKind.Struct,
  /** One of the language's own types: `string`, `duration`. */
  builtinType: CompletionItemKind.Keyword,
  /** A key of a map someone writes: an option, a field of a record. */
  key: CompletionItemKind.Field,
  /** Read bare, computed each time: `xs.len`, `m.keys`. */
  computed: CompletionItemKind.Property,
  /** Called with brackets: `m.get(k)`, `xs.map(f)`. */
  method: CompletionItemKind.Method,
  /** A variable the manifest declares. */
  env: CompletionItemKind.Constant,
  /** A file path, offered inside an import string. */
  path: CompletionItemKind.File,
  /** A keyword of the language: `step`, `forEach`. */
  keyword: CompletionItemKind.Keyword,
};

/**
 * The icon for a name the program bound, from how it was bound.
 *
 * `origin` is what {@link ScopedName} recorded when the name was found, so the
 * editor draws a `const` apart from a `let` apart from a `fn` without anyone
 * having to look the declaration up a second time.
 */
export function iconForOrigin(origin: string): CompletionItemKind {
  if (origin === "const" || origin === "dataset") return ICON.constant;
  if (origin === "fragment") return ICON.fragment;
  if (origin === "fn" || origin === "deco") return ICON.callable;
  return ICON.variable;
}
