import {
  isCaptureStmt,
  isDecoDecl,
  isFieldDecl,
  isFlowDecl,
  isFnDecl,
  isForEachStmt,
  isFragmentDecl,
  isGroupDecl,
  isLetStmt,
  isLifecycleDecl,
  isParam,
  isRepeatStmt,
  isStepDecl,
  isTryStmt,
  isTypeDecl,
} from "@venn-lang/core";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver";
import type { HighlightArgs } from "./highlight.types.js";

const DECLARATION = SemanticTokenModifiers.declaration;
const CALLABLE = { type: SemanticTokenTypes.function, modifier: DECLARATION } as const;
/**
 * A `fragment` is invoked, not called: `run` expands it into the steps it
 * declares, which the report then records. `macro` is the standard type that
 * carries that meaning, and, crucially, themes draw it apart from a function.
 * Painting the two alike would claim they are one kind of thing, which is the
 * mistake the checker refuses.
 */
const FRAGMENT = { type: SemanticTokenTypes.macro, modifier: DECLARATION } as const;
const VALUE = { type: SemanticTokenTypes.variable, modifier: DECLARATION } as const;

/** Every name a declaration introduces, plus the titles that label a flow. */
export function highlightNames(args: HighlightArgs): void {
  callableNames(args);
  decoratorNames(args);
  valueNames(args);
  memberNames(args);
  boundNames(args);
  titles(args);
}

// `deco memoize` and `@memoize` are one thing seen twice, so they colour alike.
function decoratorNames(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (!isDecoDecl(node)) return;
  acceptor({ node, property: "name", type: SemanticTokenTypes.decorator, modifier: DECLARATION });
}

function callableNames(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (isFragmentDecl(node)) acceptor({ node, property: "name", ...FRAGMENT });
  else if (isFnDecl(node)) acceptor({ node, property: "name", ...CALLABLE });
}

function valueNames(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (isCaptureStmt(node)) acceptor({ node, property: "name", ...VALUE });
  else if (isLetStmt(node)) acceptor({ node, property: "name", ...readonlyFor(node.kind) });
}

function memberNames(args: HighlightArgs): void {
  const { node, acceptor } = args;
  const type = SemanticTokenTypes.type;
  if (isParam(node)) acceptor({ node, property: "name", type: SemanticTokenTypes.parameter });
  else if (isTypeDecl(node)) acceptor({ node, property: "name", type, modifier: DECLARATION });
  else if (isFieldDecl(node)) acceptor({ node, property: "name", type: "property" });
}

// Names bound by a construct rather than declared: loop variables, `catch err`, `on <event>`.
function boundNames(args: HighlightArgs): void {
  const { node, acceptor } = args;
  if (isForEachStmt(node)) acceptor({ node, property: "item", ...VALUE });
  else if (isRepeatStmt(node) && node.index) acceptor({ node, property: "index", ...VALUE });
  else if (isTryStmt(node) && node.error) acceptor({ node, property: "error", ...VALUE });
  else if (isLifecycleDecl(node) && node.event) {
    acceptor({ node, property: "event", type: SemanticTokenTypes.enumMember });
  }
}

function titles(args: HighlightArgs): void {
  const { node, acceptor } = args;
  const title = { property: "title", type: SemanticTokenTypes.string } as const;
  if (isFlowDecl(node)) acceptor({ node, ...title });
  else if (isStepDecl(node)) acceptor({ node, ...title });
  else if (isGroupDecl(node)) acceptor({ node, ...title });
}

function readonlyFor(kind: string): { type: string; modifier: string[] } {
  const modifier =
    kind === "const" ? [DECLARATION, SemanticTokenModifiers.readonly] : [DECLARATION];
  return { type: SemanticTokenTypes.variable, modifier };
}
