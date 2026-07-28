import {
  type AstNode,
  type Document,
  type FnDecl,
  isCall,
  isFnDecl,
  isMember,
  isRef,
} from "@venn-lang/core";
import { AstUtils } from "langium";
import type { SymbolCatalog } from "../catalog/index.js";

/**
 * Which functions in a file wait for something.
 *
 * A plugin verb runs asynchronously, so anything that reaches for one hands
 * back a value still arriving, and so does anything that calls that. The
 * runtime does the waiting without a word being written; this is what lets the
 * hover say so.
 *
 * It lives here rather than in the checker because deciding whether a dotted
 * path names a verb needs the plugin registry, and `@venn-lang/core` deliberately
 * knows nothing about plugins. Being an editor's answer, it may be approximate:
 * missing one costs a hint, never a wrong program.
 */
export function waitingFns(document: Document, catalog: SymbolCatalog): ReadonlySet<string> {
  const bodies = declaredFns(document);
  const waiting = new Set<string>();
  for (const [name, decl] of bodies) {
    if (callsAVerb(decl, catalog)) waiting.add(name);
  }
  spread(bodies, waiting);
  return waiting;
}

function declaredFns(document: Document): Map<string, FnDecl> {
  const out = new Map<string, FnDecl>();
  for (const decl of document.decls) {
    if (isFnDecl(decl)) out.set(decl.name, decl);
  }
  return out;
}

/** A verb somewhere in the body, whether named or called. */
function callsAVerb(decl: FnDecl, catalog: SymbolCatalog): boolean {
  for (const node of AstUtils.streamAst(decl.body)) {
    const head = pathHead(node);
    if (head && catalog.hasNamespace(head)) return true;
  }
  return false;
}

/**
 * Then outwards, until nothing new is found: a function that calls one that
 * waits, waits. Bounded by the number of functions, so it always settles.
 */
function spread(bodies: Map<string, FnDecl>, waiting: Set<string>): void {
  for (let pass = 0; pass < bodies.size; pass += 1) {
    let grew = false;
    for (const [name, decl] of bodies) {
      if (waiting.has(name)) continue;
      if (!callsAnyOf(decl, waiting)) continue;
      waiting.add(name);
      grew = true;
    }
    if (!grew) return;
  }
}

function callsAnyOf(decl: FnDecl, names: ReadonlySet<string>): boolean {
  for (const node of AstUtils.streamAst(decl.body)) {
    if (isCall(node) && isRef(node.callee) && names.has(node.callee.name)) return true;
  }
  return false;
}

/** The first name of a dotted path: `http` in `http.get`, `fmt` in `fmt.json`. */
function pathHead(node: AstNode): string | undefined {
  if (!isMember(node)) return undefined;
  let receiver = node.receiver;
  while (isMember(receiver)) receiver = receiver.receiver;
  return isRef(receiver) ? receiver.name : undefined;
}
