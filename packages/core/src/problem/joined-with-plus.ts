/**
 * What `+` between strings is told, wherever it is written.
 *
 * Two readers reach the same mistake by different roads. `print "a" + "b"` never
 * parses, because an argument is one value, so the recovery in `parse/` speaks
 * first; `print ("a" + "b")` parses and the type check speaks instead. They used
 * to say unrelated things, and the first of them suggested the bracket that
 * produced the second. One phrase, said here, so both roads end at the same
 * sentence and the guide can quote it.
 *
 * `+` stays arithmetic. Interpolation is the one way this language joins
 * strings, and a second way would not be an improvement; what was missing was
 * anybody saying so.
 */

/** The title: what `+` is for, and what it is not for. */
export const JOINED_WITH_PLUS = "`+` adds numbers; it does not join strings.";

/** Said when the operands cannot be rewritten, so the reader still learns the way. */
const THE_WAY = "Interpolation is how this language joins strings.";

/** A name, or a dotted one, which reads the same inside a `${…}` as outside it. */
const A_PATH = /^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/;

/** Long enough that a suggested line stops being readable as one. */
const TOO_LONG = 60;

/**
 * The one string that does what the `+` was reaching for.
 *
 * Built from the operands as they were written, so the reader is handed their
 * own line back rather than a shape to fill in: `"total: " + n` becomes
 * `"total: ${n}"` and `"unknown option: " + "x"` becomes `"unknown option: x"`,
 * which is the answer in both cases and not a paraphrase of one.
 *
 * Inside a `${…}` the answer is the same text without the quotes, because the
 * string is already open around it: offering `"ab"` there would be offering a
 * quote inside a placeholder, which is its own diagnostic and would have made
 * this help line a second wrong suggestion in the place of the first.
 *
 * @param operands The source text of each operand of the `+` chain, in order.
 * @param inASlot Whether the `+` was written inside a `${…}`.
 * @returns The help line. When an operand cannot be placed in a slot without
 * guessing at it, the way out is still named but no line is offered, since a
 * suggestion that does not quite work is worse than none.
 */
export function joinInstead(operands: readonly string[], inASlot = false): string {
  const pieces = operands.map(asAPiece);
  const joined = pieces.every((piece) => piece !== undefined) ? pieces.join("") : undefined;
  if (joined === undefined || joined.length > TOO_LONG) return THE_WAY;
  if (inASlot) return `${THE_WAY} Write \`${joined}\` in place of the \`\${…}\`.`;
  return `${THE_WAY} Write \`"${joined}"\`.`;
}

/**
 * One operand as it reads inside a string: a literal contributes its own text,
 * anything else a `${…}` around it.
 *
 * A quote in the text would close the string being suggested, so an operand
 * carrying one is not offered rather than offered broken. A `${…}` already
 * inside a literal is left exactly as it is: it means there what it means here.
 */
function asAPiece(source: string): string | undefined {
  const text = source.trim();
  const inner = literalText(text);
  if (inner !== undefined) return inner.includes('"') ? undefined : inner;
  return A_PATH.test(text) ? `\${${text}}` : undefined;
}

/** What a string literal holds, in either spelling, or nothing for anything else. */
function literalText(text: string): string | undefined {
  const quoted = text.length >= 2 && (text.startsWith('"') || text.startsWith("'"));
  if (!quoted || !text.endsWith(text[0] as string)) return undefined;
  return text.slice(1, -1);
}
