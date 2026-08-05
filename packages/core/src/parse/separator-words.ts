/**
 * The sentences that name a separator, written once and shared.
 *
 * Every one of these answers the same question from a different direction: what
 * goes between two things, when the writer put nothing there. The parser meets
 * it as a `}` it wanted and did not get, the lexer meets it as a `;` it had to
 * throw away, and a header meets it as a map it read as its options. Same rule,
 * so the same words, and the words live here rather than in whichever explainer
 * happened to need them first.
 *
 * Naming a separator at all is new. The vocabulary has been in `token-words.ts`
 * from the beginning, where `NL` is "the end of the line" and `;` is "a
 * semicolon", and no message ever reached it.
 */

/**
 * What goes between two statements inside `{ }`.
 *
 * Both spellings are named because both work and the second is the one that
 * fits on the line already written. `;` lexes as an `NL` token, so it is not a
 * second rule: it is the same terminator spelled in one character.
 */
export const STATEMENTS_SEPARATED =
  "A newline or a `;` separates one statement from the next, and there is neither here.";

/**
 * What goes between two entries of a map, two arms of a `match`, two fields of
 * a `type` body or two parts of a shape pattern.
 *
 * Those four take a comma as well as a newline, so they are told about the
 * comma rather than about the `;`. Pointing somebody writing `{ a: 1 b: 2 }` at
 * a semicolon is true and is not what they meant.
 */
export const ITEMS_SEPARATED =
  "A newline or a `,` separates one entry from the next, and there is neither here.";

/**
 * What is missing inside `( )` and `[ ]`, where a newline cannot be it.
 *
 * The lexer drops newlines inside those brackets so a call may be broken across
 * lines, which leaves the comma as the only separator there.
 */
export const COMMA_IN_BRACKETS =
  "Items inside `( )` and `[ ]` are separated by a comma, and a newline there is not one.";

/**
 * What a `;` written inside `( )` or `[ ]` is told.
 *
 * Raised by the lexer rather than by the parser, since the `;` never survives
 * to reach a parse error. Same rule as `COMMA_IN_BRACKETS`, reached from the
 * one spelling that makes the writer's intent unmistakable.
 */
export const SEMICOLON_IN_BRACKETS =
  "A `;` is a statement separator, and inside `( )` and `[ ]` there are no statements, so write a comma.";

/**
 * What a header followed by a map is told, when the map was meant as the body.
 *
 * `parallel { workers: 4 }` reads the brace as options, because a trailing map
 * is always options, and then asks for a body the writer believes they already
 * wrote. Distinct from VN5007, which is about a verb that takes no options at
 * all and loses the value inside the brace; here the options are real and it is
 * the body that is missing.
 *
 * @param header The word the construct opens with, read out of the grammar.
 * @returns The line to print, naming that word.
 */
export function optionsThenBody(header: string): string {
  return `The \`{ … }\` after \`${header}\` was read as its options, not as its body. A body in \`{ }\` still has to follow it.`;
}
