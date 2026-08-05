/**
 * `print try f() else 0`, which reads as a `try` block that lost its brace.
 *
 * An argument is one value and its accesses, and a `try` is two of them with a
 * word between, so the grammar ends the argument list at `try` and starts the
 * statement form. What the parser then says is that it wanted a `{`, which is
 * true and tells nobody anything.
 */

/** Long enough to be unreadable as a suggestion, and probably not one line. */
const TOO_LONG = 60;

/** A verb, then `try`, then the token the parser stopped at. */
const VERB_THEN_TRY = /^\s*([A-Za-z_][\w.]*)\s+try\s+$/;

/** The word itself and the air after it, where the parser stopped on the `try`. */
const PAST_TRY = /^try[ \t]+/;

/**
 * A title in the language's own words, when this is that error.
 *
 * @param args The source and where in it the parser stopped.
 * @returns The title to report, or nothing when the parser did not stop just
 * past a `try` that follows a verb, which is the only shape this can explain.
 */
export function bracketTheTry(args: { text: string; offset: number }): string | undefined {
  const line = lineAt(args);
  if (!line || line.whole.trim().length > TOO_LONG) return undefined;
  // Only where the parser stopped on the first token after the `try`. A `try`
  // that goes wrong takes the rest of the line with it, and the errors that
  // follow are the same mistake read again.
  const called = line.before.match(VERB_THEN_TRY)?.[1];
  if (!called) return undefined;
  return `An argument is one value, so a \`try\` has to be bracketed. Write \`${called} (try ${line.after.trim()})\`.`;
}

/**
 * The line the parser stopped on, split just past the `try`.
 *
 * Where the parser stops depends on whether what came before the `try` was
 * already a whole statement. `print try f() else 0` leaves `print` complete, so
 * the parser stops on the `try`; a verb still waiting for an argument carries
 * it one token further. Both are the one mistake, so the split goes past the
 * word either way and the two shapes get the same sentence.
 */
function lineAt(args: { text: string; offset: number }): Line | undefined {
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const end = args.text.indexOf("\n", args.offset);
  const whole = args.text.slice(start, end === -1 ? undefined : end);
  if (/[{}#]/.test(whole)) return undefined;
  const at = args.offset - start;
  const cut = at + (PAST_TRY.exec(whole.slice(at))?.[0].length ?? 0);
  return { whole, before: whole.slice(0, cut), after: whole.slice(cut) };
}

interface Line {
  readonly whole: string;
  readonly before: string;
  readonly after: string;
}
