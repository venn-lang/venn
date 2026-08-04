import type { Problem } from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { Range } from "vscode-languageserver";

/**
 * The title, and what the check worked out beneath it.
 *
 * A diagnostic is one string in the protocol, and the editor shows all of it on
 * hover. Dropping the help means the fix a check already knows never reaches
 * the one place it would be acted on.
 *
 * @param problem The problem to publish.
 * @returns The title, then the help and the note when there are any.
 */
export function saidProblem(problem: Problem): string {
  return [problem.title, problem.help, problem.note].filter(Boolean).join("\n");
}

/**
 * Where a client draws a problem, in the protocol's zero-based positions.
 *
 * A span carries an offset and a length; the document is what turns those into
 * lines and characters, so no span has to carry its own idea of either.
 *
 * @param span The offset and length the problem was built with.
 * @param document The document the span belongs to.
 * @returns The range from the offset to the end of the span.
 */
export function spanRange(
  span: { offset: number; length: number },
  document: LangiumDocument,
): Range {
  const text = document.textDocument;
  return {
    start: text.positionAt(span.offset),
    end: text.positionAt(span.offset + span.length),
  };
}
