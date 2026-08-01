import type { Problem, RelatedInfo } from "@venn-lang/core";
import { dim } from "./colors.js";

/**
 * Everything a problem knows beneath its title, as lines.
 *
 * §16 says a well-formed error answers seven questions. The title and the span
 * answer two, and the rest were built and thrown away: a check that worked out
 * which import to write, or which name was nearly right, said so into a field
 * nobody printed.
 *
 * One function, so `venn check`, `venn run` and `venn test` read the same
 * beneath their own headings.
 *
 * @param problem The problem to describe.
 * @param args.indent What each line starts with, since the tree reporter is
 * further in than the flat one.
 * @param args.where Whether to print the location. The tree reporter prints its
 * own above this, and saying it twice reads as two places.
 * @returns The lines, in the order the questions are asked: where, what to do,
 * why the rule exists, what else to look at, and where to read more.
 */
export function problemDetail(
  problem: Problem,
  args: { indent?: string; where?: boolean } = {},
): string[] {
  const indent = args.indent ?? "  ";
  return [
    ...(args.where === false ? [] : line(indent, "at", location(problem))),
    ...line(indent, "help", problem.help),
    ...line(indent, "note", problem.note),
    ...(problem.related ?? []).flatMap((one) => line(indent, "see", related(one))),
    ...line(indent, "docs", problem.docs),
  ];
}

/** Labels are padded to one width so the text beside them lines up. */
function line(indent: string, label: string, text: string | undefined): string[] {
  return text ? [`${indent}${dim(label.padEnd(4))}  ${text}`] : [];
}

function location(problem: Problem): string | undefined {
  const { uri, line: at, column } = problem.span;
  return uri ? `${uri}:${at}:${column}` : undefined;
}

/** A second place worth looking at, and why: "here it was declared as string". */
function related(one: RelatedInfo): string {
  return `${one.span.uri}:${one.span.line}:${one.span.column}  ${one.label}`;
}
