/**
 * Whether a value has the shape a pattern that must match claimed it had.
 *
 * A `match` arm asks these questions already, through `answers`, and moves to
 * the next arm when the answer is no. A `let`, a `const`, a `forEach` and a
 * `fn` parameter cannot move on: they bind, so every question they never asked
 * became a name quietly holding nothing.
 *
 * Only the list length is asked here. A field a shape does not carry is a
 * mistake the checker already reports, because it knows field names; nothing
 * knows how long a list is until the value arrives, because the type system has
 * no tuple and `[[1, 2]]` is a `list<list<number>>` like any other.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Pattern } from "../generated/ast.js";
import { fileOf } from "../parse/index.js";
import type { Problem } from "../problem/index.js";
import { spanOf } from "../span/index.js";
import { patternTests } from "./pattern-tests.js";
import { readPath } from "./read-path.js";

/**
 * The refusal a value earns from a pattern that had to match it.
 *
 * Asked once, on the way to the first name the pattern binds, so the names
 * after it read out of a value already known to have the shape.
 *
 * @param pattern The pattern as written, which is where the problem is placed.
 * @param value What is being taken apart.
 * @returns The problem to raise, or nothing when the value fits.
 */
export function patternMisfit(pattern: Pattern, value: unknown): Problem | undefined {
  for (const test of patternTests(pattern)) {
    if (test.asks !== "a list") continue;
    const held = readPath(value, test.path);
    // Not a list at all is a different mistake, and the checker makes it where
    // the shape is known. Claiming it here would claim it about a `dynamic`.
    if (!Array.isArray(held)) continue;
    if (test.rest ? held.length >= test.items : held.length === test.items) continue;
    return itemCount({ pattern, names: test.items, rest: test.rest, held: held.length });
  }
  return undefined;
}

/** How many the pattern names against how many arrived, both counted. */
function itemCount(args: {
  pattern: Pattern;
  names: number;
  rest: boolean;
  held: number;
}): Problem {
  const before = args.rest ? " before `...`" : "";
  return buildProblem({
    spec: CODES.VN3026_PATTERN_ITEM_COUNT,
    span: spanOf(args.pattern, fileOf(args.pattern)),
    title: `This pattern names ${plural(args.names)}${before}, and the list has ${args.held}.`,
    help: args.held < args.names ? NAME_FEWER : NAME_THE_REST,
  });
}

const NAME_FEWER = "Name fewer items, or read them by position instead.";
const NAME_THE_REST = "Name the rest, or write `...rest` last to take what is left.";

function plural(many: number): string {
  return many === 1 ? "1 item" : `${many} items`;
}
