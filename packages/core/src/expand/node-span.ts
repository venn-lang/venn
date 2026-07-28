import type { AstNode } from "langium";
import type { Span } from "../problem/index.js";

/** Where a node sits in its file, for a Problem that has to point at it. */
export function spanOf(node: AstNode, uri: string): Span {
  const cst = node.$cstNode as
    | { offset: number; length: number; range?: { start: { line: number; character: number } } }
    | undefined;
  const start = cst?.range?.start;
  return {
    uri,
    offset: cst?.offset ?? 0,
    length: cst?.length ?? 0,
    line: (start?.line ?? 0) + 1,
    column: (start?.character ?? 0) + 1,
  };
}
