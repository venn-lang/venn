/**
 * A decorator handed its argument with no brackets around it.
 *
 * `@timeout 50ms` reads as a decorator with nothing in it, followed by a
 * statement that begins with a number. So the parser reports every keyword a
 * statement could have begun with and never once mentions the `@timeout` on the
 * line above the number, which is the whole mistake and the whole fix.
 */

/**
 * `@name` with nothing but air between it and where the parser stopped.
 *
 * The line may open a block, as `flow "F" { @timeout 50ms }` does, so a `{` is
 * as good a start as the start of the line.
 */
const DECO_ALONE = /(?:^|\{)[ \t]*@([A-Za-z_]\w*)[ \t]+$/;

/** Long enough that quoting it back is a paragraph rather than a suggestion. */
const TOO_LONG = 40;

/**
 * A title in the language's own words, when this is that error.
 *
 * @param args The token the parser stopped at, the source, and where in it.
 * @returns The title to report, or nothing when the line is not a decorator
 * followed by a value, which is the only shape this can explain.
 */
export function bracketTheDeco(args: {
  token: string;
  text: string;
  offset: number;
}): string | undefined {
  if (args.token === "" || args.token.length > TOO_LONG) return undefined;
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const named = DECO_ALONE.exec(args.text.slice(start, args.offset))?.[1];
  if (named === undefined) return undefined;
  return `A decorator takes its argument in brackets: write \`@${named}(${args.token})\`.`;
}
