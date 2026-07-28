/**
 * Where the cursor sits, and from which character the completion should
 * replace. Without that range VS Code falls back to its own word rules, which
 * break on `@` and `/`: accepting `@venn-lang/http` inside `"@venn-lang/"` would paste
 * the prefix twice.
 */
export type CompletionContext =
  | { kind: "package"; from: number }
  | { kind: "modulePath"; from: number; partial: string }
  | { kind: "importName"; from: number; path?: string }
  /** After a dot. `receiver` is the whole path before it: a namespace or a value. */
  | { kind: "action"; from: number; receiver: string }
  /** After a dot whose receiver is not a name: the AST node has to answer. */
  | { kind: "member"; from: number }
  | { kind: "annotation"; from: number }
  | { kind: "fragment"; from: number }
  | { kind: "matcher"; from: number }
  /** Inside the `{ … }` of a call; `target` is the action whose keys to offer. */
  | { kind: "optionKey"; from: number; target: string }
  /**
   * After a verb and a space: `http.on ▮`. Whether `target` really is a verb is
   * not a question text can answer, so the provider checks and falls back to a
   * plain statement when nothing in the language answers to that name.
   */
  | { kind: "argument"; from: number; target: string }
  /** Where a type goes: after the `:` of a field, a parameter or a binding. */
  | { kind: "typeName"; from: number }
  | { kind: "statement"; from: number };

/** The text the classifier reads: the current line, and everything before the cursor. */
export interface CursorText {
  /** The current line up to the cursor; `from` is a column on this line. */
  prefix: string;
  /** The whole current line. */
  line: string;
  /** The whole document up to the cursor; an options map spans lines. */
  before: string;
}
