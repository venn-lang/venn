import type { Call } from "../generated/ast.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";

/**
 * Why calling this is a mistake, said in the words of what was probably meant.
 *
 * `data.range 1 (n + 1)` is the shape this exists for. Brackets after a value
 * are always a call, which is what makes `conn.close()` work, so that line reads
 * as calling the number `1`. Nothing about `expected fn(number) -> number, found
 * number` points at the brackets, and the same mistake at run time only says the
 * value is not a function.
 */

/** Kinds that are certainly not functions, so calling one is certainly wrong. */
const NOT_FUNCTIONS = new Set(["prim", "record", "list", "literal", "opaque"]);

/** How long a quoted piece of source can be before it stops helping. */
const TOO_LONG = 40;

/**
 * The rule that explains the mistake, and the way out of it.
 *
 * Said whether or not the call is an argument, because the two are the same
 * shape in the tree: `print n(2)` and `data.range 1 (n + 1)` cannot be told
 * apart, and the sentence is true of both.
 */
const RULE =
  "brackets after a value are always a call. Several arguments go inside one bracket, separated by commas.";

/**
 * The title for a call on something that cannot be called.
 *
 * @param args The call as written, and the type its callee turned out to have.
 * @returns The title, or nothing when the ordinary type mismatch says it better:
 * a callee whose type is still open, or a function of another shape, where
 * naming the two types is exactly what a reader needs.
 */
export function callingAValue(args: { expr: Call; callee: Type }): string | undefined {
  if (!NOT_FUNCTIONS.has(args.callee.kind)) return undefined;
  const kind = showType(args.callee);
  const written = source(args.expr);
  const lead = written ? `\`${written}\` reads as a call, and ` : "";
  return `${lead}${kind} cannot be called: ${RULE}`;
}

/** What was written, when it is short enough to quote back. */
function source(expr: Call): string | undefined {
  const text = (expr.$cstNode as { text?: string } | undefined)?.text?.trim();
  if (!text || text.length > TOO_LONG) return undefined;
  return text.split(/\s+/).join(" ");
}
