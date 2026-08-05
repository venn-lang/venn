/**
 * The one way this language offers a name it thinks was meant.
 *
 * Beside {@link nearestName} rather than inside a checker, for the same reason
 * the search is: six places suggest a name, and the question they ask a reader
 * is one question. The search decides whether there is an answer; this decides
 * how the answer reads.
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
