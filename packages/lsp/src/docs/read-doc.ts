import { type Annotation, type AstNode, isStringLit } from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { DocBlock } from "./doc.types.js";
import { parseDoc } from "./parse-doc.js";

const DOC_PREFIX = "##";

/**
 * The documentation attached to a declaration: a `##` block directly above it,
 * or its `@doc("…")` annotation (§08). `##` wins when both are present.
 *
 * @returns The parsed block, or `undefined` when the declaration has neither.
 */
export function readDoc(document: LangiumDocument, node: AstNode): DocBlock | undefined {
  const lines = docLinesAbove(document, node);
  if (lines.length > 0) return parseDoc(lines);
  const annotated = docAnnotation(node);
  return annotated ? parseDoc(annotated.split("\n")) : undefined;
}

// Walk back over whole lines while they keep starting with `##`.
function docLinesAbove(document: LangiumDocument, node: AstNode): string[] {
  const offset = node.$cstNode?.offset;
  if (offset === undefined) return [];
  const before = document.textDocument.getText().slice(0, offset).split("\n");
  before.pop();
  const lines: string[] = [];
  for (let index = before.length - 1; index >= 0; index--) {
    const text = (before[index] ?? "").trim();
    if (!text.startsWith(DOC_PREFIX)) break;
    lines.unshift(strip(text));
  }
  return lines;
}

function strip(line: string): string {
  return line.slice(DOC_PREFIX.length).replace(/^ /, "");
}

function docAnnotation(node: AstNode): string | undefined {
  const annotations = (node as { annotations?: Annotation[] }).annotations ?? [];
  const doc = annotations.find((annotation) => annotation.name === "doc");
  const first = doc?.args?.args?.[0]?.value;
  return first && isStringLit(first) ? first.value : undefined;
}
