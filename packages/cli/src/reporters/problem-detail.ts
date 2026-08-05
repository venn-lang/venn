import { type Problem, problemLines } from "@venn-lang/core";
import { dim } from "./colors.js";
import type { Stream } from "./colors.types.js";

/**
 * Everything a problem knows beneath its title, as terminal lines.
 *
 * Which lines a problem has and what each one reads as is decided once, beside
 * the problem, by `problemLines`. This is only the terminal over it: an indent,
 * a dim label padded to one width, and the gap that lines the text up. Keeping
 * the two apart is what lets the editor and anything else render the same
 * failure instead of each keeping its own idea of it.
 *
 * @param problem The problem to describe.
 * @param args.indent What each line starts with, since the tree reporter is
 * further in than the flat one.
 * @param args.where Whether to print the location. The tree reporter prints its
 * own above this, and saying it twice reads as two places.
 * @param args.stream Where these lines are going, since colour is a question
 * about one stream: these are written to standard error as often as not, and
 * whether standard output is a terminal says nothing about that one.
 * @returns The lines, in the order the questions are asked: where, what to do,
 * why the rule exists, what else to look at, and where to read more.
 */
export function problemDetail(
  problem: Problem,
  args: { indent?: string; where?: boolean; stream?: Stream } = {},
): string[] {
  const indent = args.indent ?? "  ";
  const lines = problemLines(problem);
  const wanted = args.where === false ? lines.filter((one) => one.label !== "at") : lines;
  return wanted.map((one) => `${indent}${dim(one.label.padEnd(4), args.stream)}  ${one.text}`);
}
