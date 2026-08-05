import { isFailure } from "./caught.js";
import { problemOf } from "./problem-of.js";
import type { Span } from "./span.types.js";
import type { Thrown } from "./thrown.types.js";

/**
 * Give a failure the place it does not carry.
 *
 * A compile diagnostic points at a line because the checker holds the node. A
 * failure raised while running is thrown by an operator, a call or a plugin,
 * none of which holds one, so the place is added by the thing that does: the
 * compiled node the throw passed through on its way out.
 *
 * Nothing already placed is moved. The first node to catch a throw is the
 * closest one to it, and an enclosing node is a worse answer than the raiser's
 * own line.
 *
 * A throw carrying no `Problem` at all is given one, built by `problemOf`,
 * which is where a throw becomes a problem. It is attached rather than wrapped
 * so the throw keeps its identity: `catch e { e.data }` reads `detail.data` off
 * the original, and a rethrown copy would carry none.
 *
 * @param thrown Whatever unwound. Anything that is not a failure is left
 * untouched, because `break`, `continue` and `exit` are the program going where
 * it was told and are not problems.
 * @param span Where the node that caught it sits.
 */
export function placeAt(thrown: unknown, span: Span): void {
  if (!isFailure(thrown)) return;
  const held = thrown as Thrown;
  const problem = held.problem;
  if (!problem) {
    held.problem = problemOf({ thrown, span });
    return;
  }
  if (!problem.span.uri) problem.span = span;
}
