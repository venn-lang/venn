/**
 * What an explainer answers with: the line to print, and where to point it when
 * that is not where the parser itself stopped.
 *
 * Recovery lands on the token the parser could not go past, which is often a
 * word or two away from the one that was actually refused, so an explainer that
 * knows better says so.
 */
export interface Explained {
  readonly title: string;
  readonly offset?: number;
  /**
   * How much to underline, when the relocated span is not a word.
   *
   * A missing separator is a gap between two tokens rather than a token, so it
   * has a width of its own and the default word length would squiggle whatever
   * happens to follow it.
   */
  readonly length?: number;
}

/**
 * Where the parser stopped, in the terms an explainer can reason about.
 *
 * The older explainers here read only the source text, because the shape they
 * recognise is a shape on a line. A missing separator is not: the same token in
 * the same column is a mistake inside a block and fine at the top of a file, so
 * these carry what the parser itself knew at the moment it gave up.
 */
export interface ParserStop {
  /** The parser's own message, which names the one token it wanted. */
  readonly message: string;
  /** The text of the token it stopped at, empty at the end of the file. */
  readonly token: string;
  /** That token's type: a terminal's name (`ID`), or the keyword itself (`step`). */
  readonly tokenType: string;
  /** The rules it was inside when it gave up, outermost first. */
  readonly ruleStack: readonly string[];
  /** The whole source, which is where a gap between two tokens can be measured. */
  readonly text: string;
  /** Where the token starts, which is not a number at the end of the file. */
  readonly offset: number;
}
