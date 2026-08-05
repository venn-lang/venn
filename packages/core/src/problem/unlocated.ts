import type { Span } from "./span.types.js";

/**
 * The span of a failure nobody could place.
 *
 * A refusal raised below the source, by an operator with no node to point at,
 * by a verb reached long after the map it came from was a value, or by a
 * decorator body that will be located by the statement that asked. Eight files
 * spelled this object out for themselves, so a search for one of them found
 * seven and the eighth was named something else.
 *
 * The empty uri is the point rather than an omission: `problemLines` prints no
 * location for it, and `pretty` drops the `at` line, which is the truth. Line 1
 * and column 1 are there because `Span` requires numbers, and every reader that
 * matters checks the uri before it reads them.
 */
export const UNLOCATED: Span = { uri: "", offset: 0, length: 0, line: 1, column: 1 };
