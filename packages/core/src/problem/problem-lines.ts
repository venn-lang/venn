import type { Problem } from "./problem.types.js";
import type { ProblemLine } from "./problem-line.types.js";
import type { RelatedInfo } from "./related.types.js";
import type { Span } from "./span.types.js";

/**
 * Everything a problem knows beneath its title, as labelled lines.
 *
 * §16 says a well-formed error answers seven questions. The title and the code
 * answer two; these are the rest, in the order the questions are asked: where,
 * what to do, why the rule exists, what else to look at, and where to read
 * more.
 *
 * Presentation-free on purpose. Deciding which fields a problem has and what
 * each one reads as is the problem's business and belongs beside it, so the
 * terminal, the editor and anything else render the same failure rather than
 * each keeping their own idea of it. Colour, padding and indentation are the
 * renderer's, and none of them is here.
 *
 * @param problem The problem to describe.
 * @returns The lines it has, omitting every question it cannot answer.
 */
export function problemLines(problem: Problem): ProblemLine[] {
  return [
    ...line("at", placeOf(problem.span)),
    ...line("help", problem.help),
    ...line("note", problem.note),
    ...(problem.related ?? []).flatMap((one) => line("see", relatedText(one))),
    ...line("docs", problem.docs),
  ];
}

function line(label: ProblemLine["label"], text: string | undefined): ProblemLine[] {
  return text ? [{ label, text }] : [];
}

/** Where it happened, as it reads in a report: `orders.vn:12:5`. */
function placeOf(span: Span): string | undefined {
  return span.uri ? `${span.uri}:${span.line}:${span.column}` : undefined;
}

/** A second place worth looking at, and why: "here it was declared as string". */
function relatedText(one: RelatedInfo): string {
  return `${one.span.uri}:${one.span.line}:${one.span.column}  ${one.label}`;
}
