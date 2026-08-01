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

/** The line the parser stopped on, split at the token it stopped at. */
function lineAt(args: { text: string; offset: number }): Line | undefined {
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const end = args.text.indexOf("\n", args.offset);
  const whole = args.text.slice(start, end === -1 ? undefined : end);
  if (/[{}#]/.test(whole)) return undefined;
  return {
    whole,
    before: whole.slice(0, args.offset - start),
    after: whole.slice(args.offset - start),
  };
}

interface Line {
  readonly whole: string;
  readonly before: string;
  readonly after: string;
}
