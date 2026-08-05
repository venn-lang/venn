/**
 * An operator brought from another language, which this one never had.
 *
 * `a += 2` lexes as a name, a `+`, an `=` and a number, so the grammar reads a
 * verb called `a` being handed an argument and stops at the `+`. What came back
 * was ``An argument is one value, so `+` has to be bracketed``, about a line
 * with nothing to bracket, and `x++` got the same. Neither is an argument and
 * neither wants a bracket: the spelling does not exist here.
 *
 * Read off the parser's own stopping places rather than off the whole source,
 * so a `+=` inside a string or a comment is what it is, and a line the parser
 * was happy with is never given a new error.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Problem } from "../problem/index.js";
import { lineStart, spanAt } from "./at-an-offset.js";
import { noSuchSpelling } from "./removed-syntax.js";

/** A name, or a dotted one: what may stand on the left of a plain assignment. */
const A_PLACE = /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*$/;

/**
 * The two-character operators this language does not have, and what each one
 * was reaching for.
 *
 * Every `help` here was run against the built CLI before it was written down.
 * `set a to a + 2` is not Venn and neither is `a += 2`; plain assignment is.
 */
const NOT_HERE = new Map<string, string>([
  ["+=", "+"],
  ["-=", "-"],
  ["*=", "*"],
  ["/=", "/"],
  ["%=", "%"],
  ["++", "+ 1"],
  ["--", "- 1"],
]);

/**
 * Every operator the language does not have, where the parser tripped over one.
 *
 * @param args The source, the uri to record on each span, and the offsets the
 * parser stopped at.
 * @returns One problem per such operator, empty when the file uses none.
 */
export function noSuchOperator(args: {
  text: string;
  uri: string;
  stopped: ReadonlySet<number>;
}): Problem[] {
  const found: Problem[] = [];
  for (const offset of [...args.stopped].sort((a, b) => a - b)) {
    const problem = operatorAt(offset, args);
    if (problem) found.push(problem);
  }
  return found;
}

/** The problem for one stopping place, or nothing when it is some other error. */
function operatorAt(offset: number, args: { text: string; uri: string }): Problem | undefined {
  const written = args.text.slice(offset, offset + 2);
  const arithmetic = NOT_HERE.get(written);
  if (arithmetic === undefined) return undefined;
  return buildProblem({
    spec: CODES.VN1005_NO_SUCH_OPERATOR,
    span: spanAt({ text: args.text, uri: args.uri, offset, length: written.length }),
    title: noSuchSpelling(written),
    help: instead({ written, arithmetic, text: args.text, offset }),
  });
}

/** What to write instead: the assignment the compound operator was standing for. */
function instead(args: {
  written: string;
  arithmetic: string;
  text: string;
  offset: number;
}): string {
  const { written, arithmetic, text, offset } = args;
  const place = A_PLACE.exec(text.slice(lineStart(text, offset), offset))?.[1];
  const value = written.endsWith("=") ? rightOf(text, offset + 2) : "";
  if (!place || (written.endsWith("=") && value === "")) return SPELL_IT_OUT;
  const whole = value === "" ? arithmetic : `${arithmetic} ${value}`;
  return `Write \`${place} = ${place} ${whole}\`.`;
}

/** Said when the line cannot be rebuilt, so nothing is offered that might not run. */
const SPELL_IT_OUT = "Write the assignment out in full: the name, `=`, then the whole value.";

/** The rest of the line, which is what the compound operator was applying. */
function rightOf(text: string, from: number): string {
  const end = text.indexOf("\n", from);
  return text.slice(from, end === -1 ? undefined : end).trim();
}
