import type { Span } from "@venn-lang/core";

/** Minimal structural view of a Langium CST node (avoids importing langium). */
interface CstView {
  offset?: number;
  length?: number;
  text?: string;
  range?: { start?: { line?: number; character?: number } };
}
interface WithCst {
  $cstNode?: CstView;
}

/** The exact source text of an AST node, for the event stream. */
export function nodeSource(node: WithCst): string {
  return node.$cstNode?.text ?? "";
}

/** A Span for an AST node, for a runtime Problem. */
export function nodeSpan(node: WithCst, uri: string): Span {
  const cst = node.$cstNode;
  return {
    uri,
    offset: cst?.offset ?? 0,
    length: cst?.length ?? 0,
    line: (cst?.range?.start?.line ?? 0) + 1,
    column: (cst?.range?.start?.character ?? 0) + 1,
  };
}
