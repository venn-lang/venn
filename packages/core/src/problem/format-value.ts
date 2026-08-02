import { displayValue } from "../interpolation/stringify-value.js";

/** Past this a value stops informing and starts scrolling. */
const LIMIT = 200;

/**
 * One side of a diff, written the way the language writes a value.
 *
 * The same definition `print` and `${}` use, because the title of a failure and
 * the body under it show the same two values, and a message that disagrees with
 * itself reads worse than one wrong the same way twice. This file used to hold
 * its own copy: structures as compact JSON, and a map too awkward to print
 * described in prose as `a map with 12 fields`, which is a different shape
 * rather than less of the same one.
 *
 * Two things are not taken verbatim. A key missing from one side reads `absent`
 * rather than `null`, which is a distinction only the walk below can produce and
 * one the title never has occasion to make: it says whether the producer left
 * the field out, which is usually the answer.
 *
 * And a string. `displayValue` leaves one at the top level bare, which is right
 * for `print name` and wrong here: a side of a comparison stands among values,
 * so `"1"` has to be told from `1`. That is the rule the renderer itself applies
 * one level in.
 *
 * @param value The side to show.
 * @returns Its text. Nothing can read as `[object Object]`, because a failure
 * that hides what it compared is not a report.
 */
export function formatValue(value: unknown): string {
  if (value === undefined) return "absent";
  if (typeof value === "string") return JSON.stringify(value);
  return displayValue(value);
}

/** Trim for display only. Sameness is decided on the untrimmed rendering. */
export function clamp(text: string): string {
  return text.length <= LIMIT ? text : `${text.slice(0, LIMIT)}…`;
}
