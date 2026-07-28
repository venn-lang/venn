import { isCall, isMember, isRef, MEMBER_DOCS } from "@venn-lang/core";
import { SemanticTokenModifiers, SemanticTokenTypes } from "vscode-languageserver";
import type { SymbolCatalog } from "../catalog/index.js";
import { findBinding, pathOf } from "../document/index.js";
import type { HighlightArgs } from "./highlight.types.js";

const LIB = SemanticTokenModifiers.defaultLibrary;

/** Every built-in member name, whatever kind of value it hangs off. */
const BUILT_IN = new Set(Object.values(MEMBER_DOCS).flatMap((table) => Object.keys(table)));

/**
 * Colour what a `.` reaches. The parser cannot tell `http.post` from
 * `res.status`, since both are member chains, so the catalog and the built-in
 * tables decide: a plugin verb reads as a function, a built-in as a method, and
 * anything else as the field it is.
 *
 * Returns whether it claimed the node; tokens must not overlap.
 */
export function highlightPath(args: HighlightArgs): boolean {
  const { node, acceptor } = args;
  if (isRef(node)) return namespaceHead(node.name, args);
  if (!isMember(node)) return false;
  acceptor({ node, property: "member", ...memberToken(node.member, args) });
  return true;
}

interface Token {
  type: string;
  modifier?: string | string[];
}

/** A plugin verb, a built-in method, or an ordinary field. */
function memberToken(member: string, args: HighlightArgs): Token {
  const path = pathOf(args.node);
  if (path && isStdlibPath(path, args)) return stdlibToken(path, args.catalog);
  if (BUILT_IN.has(member)) {
    return { type: methodOrProperty(args), modifier: LIB };
  }
  return { type: SemanticTokenTypes.property };
}

/** `xs.map(…)` is a method; `xs.len` is a property, read without parentheses. */
function methodOrProperty(args: HighlightArgs): string {
  return isCall(args.node.$container) && args.node.$container.callee === args.node
    ? SemanticTokenTypes.method
    : SemanticTokenTypes.property;
}

/** The head of `http.post` is a namespace, not a variable nobody declared. */
function namespaceHead(name: string, args: HighlightArgs): boolean {
  if (!isNamespace(name, args)) return false;
  args.acceptor({
    node: args.node,
    property: "name",
    type: SemanticTokenTypes.namespace,
    modifier: LIB,
  });
  return true;
}

/** Scope wins: a variable named `auth` stays a variable even though `auth` is a namespace. */
function isNamespace(name: string, args: HighlightArgs): boolean {
  return args.catalog.hasNamespace(name) && !findBinding(args.node, name);
}

/** The last segment is the verb when the whole path names an action. */
function stdlibToken(path: string, catalog: SymbolCatalog): Token {
  const namespace = path.slice(0, path.indexOf("."));
  const name = path.slice(path.indexOf(".") + 1);
  const type = catalog.action(namespace, name)
    ? SemanticTokenTypes.function
    : SemanticTokenTypes.property;
  return { type, modifier: LIB };
}

function isStdlibPath(path: string, args: HighlightArgs): boolean {
  const dot = path.indexOf(".");
  return dot > 0 && isNamespace(path.slice(0, dot), args);
}
