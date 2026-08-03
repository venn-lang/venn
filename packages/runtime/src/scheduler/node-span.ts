import type { SpanNode } from "@venn-lang/core";

/**
 * A Span for an AST node, for a runtime Problem.
 *
 * Core's answer under the runtime's name for it. A problem raised while running
 * has to point at the same place a problem raised while checking does, and a
 * `${…}` was one of the places three copies of this used to disagree about.
 */
export { spanOf as nodeSpan } from "@venn-lang/core";

/** The exact source text of an AST node, for the event stream. */
export function nodeSource(node: SpanNode): string {
  return node.$cstNode?.text ?? "";
}
