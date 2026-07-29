/**
 * The one syntax error worth explaining rather than reporting.
 *
 * An argument written without brackets is a value and its postfixes, never an
 * operation: `print 300ms + 1s` stops at the `+`. The grammar is deliberate,
 * since `a - b` after a call that takes several arguments could as easily be two
 * of them, but the parser's own words ("Expecting token of type EOF but found
 * `+`") explain none of that and everybody hits it.
 */

/** Every operator that only ever joins two values, and `-`, which also negates. */
const BINARY = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "==",
  "!=",
  "~=",
  "<",
  ">",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "in",
]);

/** Long enough to be unreadable as a suggestion, and probably not one line. */
const TOO_LONG = 60;

/** What can be called: a name, or a dotted one such as `http.get`. */
const CALLED = /^[A-Za-z_][\w.]*$/;

/**
 * A title in the language's own words, when this is that error.
 *
 * @param args The operator the parser stopped at, the source, and where in it.
 * @returns The title to report, or nothing when this is some other error and the
 * parser's own message is the better one.
 */
export function bracketTheArgument(args: {
  operator: string;
  text: string;
  offset: number;
}): string | undefined {
  if (!BINARY.has(args.operator)) return undefined;
  const fix = suggestion({ text: args.text, offset: args.offset });
  const lead = `An argument cannot hold \`${args.operator}\` unless it is bracketed.`;
  return fix ? `${lead} Write \`${fix}\`.` : `${lead} Put brackets around the whole argument.`;
}

/**
 * The line rewritten with the argument bracketed.
 *
 * The first word is what is being called, and everything after it is the
 * argument, which holds for the shape people actually write. Left out entirely
 * when the line is long or carries a block, since a suggestion that does not
 * quite work is worse than none.
 */
function suggestion(args: { text: string; offset: number }): string | undefined {
  const line = lineAt(args);
  if (line.length > TOO_LONG || /[{}#]/.test(line)) return undefined;
  const at = line.indexOf(" ");
  if (at <= 0) return undefined;
  const called = line.slice(0, at);
  const argument = line.slice(at + 1).trim();
  if (!CALLED.test(called) || argument.length === 0) return undefined;
  return `${called} (${argument})`;
}

function lineAt(args: { text: string; offset: number }): string {
  const before = args.text.lastIndexOf("\n", args.offset) + 1;
  const after = args.text.indexOf("\n", args.offset);
  return args.text.slice(before, after === -1 ? undefined : after).trim();
}
