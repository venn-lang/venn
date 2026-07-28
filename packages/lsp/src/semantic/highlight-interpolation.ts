import {
  EXPRESSION_OFFSET,
  type Expr,
  type InterpolationSlot,
  isCall,
  isMember,
  isPrelude,
  isRef,
  isStringLit,
  type Member,
  parseExpression,
  scanInterpolations,
} from "@venn/core";
import { AstUtils, type CstNode, GrammarUtils } from "langium";
import type { SemanticTokenAcceptor } from "langium/lsp";
import { type Range, SemanticTokenTypes } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { SymbolCatalog } from "../catalog/index.js";
import { pathOf } from "../document/index.js";
import type { HighlightArgs } from "./highlight.types.js";

interface Segment {
  offset: number;
  length: number;
  type: string;
}

/**
 * A string holding `${…}` is not one string token: the placeholders carry code,
 * and code the editor paints as prose is code nobody can read.
 *
 * Returns whether it claimed the node, so the plain-literal pass leaves it
 * alone: semantic tokens must not overlap.
 */
export function highlightInterpolation(args: HighlightArgs): boolean {
  const { node, acceptor } = args;
  if (!isStringLit(node) || !node.$cstNode) return false;
  const raw = node.$cstNode.text;
  const slots = scanInterpolations(raw);
  if (slots.length === 0) return false;
  const doc = AstUtils.getDocument(node).textDocument;
  emitSegments({ acceptor, doc, raw, base: node.$cstNode.offset, slots, catalog: args.catalog });
  return true;
}

interface EmitArgs {
  acceptor: SemanticTokenAcceptor;
  doc: TextDocument;
  base: number;
  catalog: SymbolCatalog;
}

function emitSegments(args: EmitArgs & { raw: string; slots: readonly InterpolationSlot[] }): void {
  let cursor = 0;
  for (const slot of args.slots) {
    const tail = slot.sourceStart + slot.source.length;
    emit(args, { offset: cursor, length: slot.start - cursor, type: SemanticTokenTypes.string });
    emit(args, { offset: slot.start, length: 2, type: SemanticTokenTypes.operator });
    for (const part of expressionSegments(slot, args.catalog)) emit(args, part);
    emit(args, { offset: tail, length: slot.end - tail, type: SemanticTokenTypes.operator });
    cursor = slot.end;
  }
  emit(args, { offset: cursor, length: args.raw.length - cursor, type: SemanticTokenTypes.string });
}

/** One token. Empty spans are skipped: a placeholder can sit flush to a quote. */
function emit(args: EmitArgs, segment: Segment): void {
  if (segment.length <= 0) return;
  args.acceptor({
    range: rangeAt(args.doc, args.base + segment.offset, segment.length),
    type: segment.type,
  });
}

function rangeAt(doc: TextDocument, offset: number, length: number): Range {
  return { start: doc.positionAt(offset), end: doc.positionAt(offset + length) };
}

/**
 * The tokens inside one placeholder, in document order. A placeholder that does
 * not parse stays plain string; the validator is what complains about it.
 */
function expressionSegments(slot: InterpolationSlot, catalog: SymbolCatalog): Segment[] {
  const expr = parseExpression(slot.source);
  if (!expr) {
    return [
      { offset: slot.sourceStart, length: slot.source.length, type: SemanticTokenTypes.string },
    ];
  }
  const shift = slot.sourceStart - EXPRESSION_OFFSET;
  return namedParts(expr, catalog)
    .map((part) => ({ ...part, offset: part.offset + shift }))
    .sort((left, right) => left.offset - right.offset);
}

/**
 * Classify the names inside a placeholder the same way code outside one is
 * classified: a namespace head reads as a namespace, a called member as a
 * method, a plain read as a property. Anything less and `${fmt.json(xs.map(f))}`
 * comes out as flat prose.
 */
function namedParts(expr: Expr, catalog: SymbolCatalog): Segment[] {
  const found: Segment[] = [];
  for (const node of AstUtils.streamAst(expr)) {
    if (isRef(node)) collect(found, node.$cstNode, headType(node.name, catalog));
    else if (isMember(node)) {
      const cst = GrammarUtils.findNodeForProperty(node.$cstNode, "member");
      collect(found, cst, memberTokenType(node, catalog));
    }
  }
  return found;
}

/** The head of `fmt.json` is a namespace; a prelude name reads as a function. */
function headType(name: string, catalog: SymbolCatalog): string {
  if (catalog.hasNamespace(name)) return SemanticTokenTypes.namespace;
  return isPrelude(name) ? SemanticTokenTypes.function : SemanticTokenTypes.variable;
}

function memberTokenType(node: Member, catalog: SymbolCatalog): string {
  const path = pathOf(node);
  const dot = path?.indexOf(".") ?? -1;
  if (path && dot > 0 && catalog.hasNamespace(path.slice(0, dot))) {
    return catalog.action(path.slice(0, dot), path.slice(dot + 1))
      ? SemanticTokenTypes.function
      : SemanticTokenTypes.property;
  }
  return isCall(node.$container) && node.$container.callee === node
    ? SemanticTokenTypes.method
    : SemanticTokenTypes.property;
}

function collect(into: Segment[], cst: CstNode | undefined, type: string): void {
  if (cst) into.push({ offset: cst.offset, length: cst.length, type });
}
