/**
 * A verb written inside a `fn`, which is pure at every depth of its body.
 *
 * A pure body has statements of its own and a call is not one of them, so a line
 * that starts with a name is on its way to being an assignment and stops at the
 * argument. What the parser says then is that it wanted a `=`, which names the
 * token it reached and never the rule that refused the line.
 */

/** Everything before the token the parser stopped at, when it is one name. */
const VERB_ALONE = /^[ \t]*([A-Za-z_][\w.]*)[ \t]*$/;

/** What opens a body, so the nearest one above the line says which body this is. */
const OPENS_A_BODY = /^[ \t]*(?:pub[ \t]+)?(fn|fragment|flow|deco|step|group|namespace)\b/;

/** A line that closes a block, whatever else it goes on to do. */
const CLOSES = /^[ \t]*}/;

/**
 * A title in the language's own words, when this is that error.
 *
 * @param args The source and where in it the parser stopped.
 * @returns The title to report, or nothing when the line is not a verb and its
 * argument written inside a `fn`, which is the only shape this can explain.
 */
export function verbInAFn(args: { text: string; offset: number }): string | undefined {
  const start = args.text.lastIndexOf("\n", args.offset) + 1;
  const end = args.text.indexOf("\n", args.offset);
  // With nothing after the name the line is no call at all, and reading it as
  // one would explain a mistake nobody made.
  if (args.text.slice(args.offset, end === -1 ? undefined : end).trim() === "") return undefined;
  const called = args.text.slice(start, args.offset).match(VERB_ALONE)?.[1];
  if (!called || !insideFn(args.text.slice(0, start))) return undefined;
  return `A \`fn\` is pure, so it cannot call \`${called}\`. A verb belongs in a \`fragment\`, or at the top level of a file.`;
}

/**
 * Whether the block this line was written in belongs to a `fn`.
 *
 * Read upward, counting the blocks that closed on the way, so a `fn` whose `}`
 * is already behind the line is not taken for the body it sits in. A block that
 * opens no body of its own, an `if` or a map written over several lines, is
 * passed over: what is wanted is the declaration around it.
 */
function insideFn(above: string): boolean {
  let closed = 0;
  for (const written of above.split("\n").reverse()) {
    const line = written.trimEnd();
    const brace = braceOf(line);
    if (brace === "shuts") closed += 1;
    else if (brace !== "opens") continue;
    else if (closed > 0) closed -= 1;
    else {
      const opened = line.match(OPENS_A_BODY);
      if (opened) return opened[1] === "fn";
    }
  }
  return false;
}

/** What a line does to the nesting: `} else {` does both, so it does neither. */
function braceOf(line: string): "opens" | "shuts" | "neither" {
  const opens = line.endsWith("{");
  const shuts = CLOSES.test(line);
  if (opens === shuts) return "neither";
  return opens ? "opens" : "shuts";
}
