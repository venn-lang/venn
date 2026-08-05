/**
 * A list the grammar writes as items with something between them.
 *
 * Every construct this parse layer has to explain a missing separator for is
 * one of these, and the grammar already says which token goes between two items
 * and what an item may start with. Reading it from there rather than listing
 * keywords here is the point: the list cannot fall behind the language.
 */
export interface SeparatedList {
  /**
   * The token names that may stand between two items.
   *
   * `NL` for a block of statements, `,` and `NL` for the map-shaped lists, `,`
   * alone inside `( )` and `[ ]`, where the lexer has taken the newlines away.
   */
  readonly separators: ReadonlySet<string>;

  /**
   * The keyword the list ends with, where the grammar closes it with one.
   *
   * Nothing for a list that runs to the end of the file, which is what the top
   * level of a document is. This is what tells a list that ran out of items
   * from a construct still waiting for a part of its own: a `flow` with no body
   * asks for a `{`, and a `{ }` full of statements asks for a `}`.
   */
  readonly closer?: string;

  /** Every token name an item may begin with, so a stray one can be recognised. */
  readonly starts: ReadonlySet<string>;
}
