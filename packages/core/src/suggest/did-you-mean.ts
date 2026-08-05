/**
 * The one way this language offers a name it thinks was meant.
 *
 * Beside {@link nearestName} rather than inside a checker, for the same reason
 * the search is: six places suggest a name, and the question they ask a reader
 * is one question. The search decides whether there is an answer; this decides
 * how the answer reads.
 *
 * Two renderings, because the offer is an instruction to substitute and what a
 * reader substitutes is not always what the diagnostic underlines. Almost every
 * offered name is a token the source writes bare, and a code span around it is
 * the whole of the instruction. A package path is not: it is only ever written
 * inside quotes, so `venn/io` handed back bare is a line that does not parse.
 */

/**
 * The offer, as a help line.
 *
 * @param near The name found, which the caller has already decided is close
 * enough to be worth naming.
 * @returns The sentence, backticked the way every spelling in a help line is.
 */
export function didYouMean(near: string): string {
  return `Did you mean \`${near}\`?`;
}

/**
 * The same offer for a name the source spells inside quotes.
 *
 * `import { io } from "venn/iio"` is corrected by writing the offered path
 * between the quotes that are already there, so the offer is shown between
 * quotes too: what the reader reads is what the line has to end up saying.
 *
 * @param near The name found, already decided to be worth naming.
 * @returns The sentence, double quoted the way the source quotes such a name.
 */
export function didYouMeanQuoted(near: string): string {
  return `Did you mean "${near}"?`;
}
