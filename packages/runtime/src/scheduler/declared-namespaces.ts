import {
  type AstNode,
  buildProblem,
  CODES,
  closureOfDecl,
  decorateCallable,
  evaluate,
  isFnDecl,
  isLetStmt,
  isNamespaceDecl,
  type NamespaceDecl,
  ProblemError,
} from "@venn-lang/core";
import { binderFor, type Scope } from "../scope/index.js";
import { heldByANamespace, wordFor } from "./namespace-member.js";
import { nodeSpan } from "./node-span.js";

/** A declaration list: a file's, or one namespace's. */
type Declared = readonly { readonly $type: string }[];

/**
 * `namespace cart { … }` as a value.
 *
 * Its body is a scope of its own, a child of the one it was written in, so what
 * it declares reaches the file's names and the file does not reach back in. What
 * the name holds is what `pub` marked, which is the module rule and not a second
 * one: a helper beside a published function is private for the same reason and
 * by the same word.
 *
 * Bound before the file's plain values, so a global may read `cart.rate`, and
 * after its functions, so a value inside one may call them.
 */
export function bindDeclaredNamespaces(decls: Declared, scope: Scope): void {
  for (const decl of decls) {
    if (isNamespaceDecl(decl)) scope.set(decl.name, faceOf(decl, scope));
  }
}

/** Everything the block declares, bound inside; only what it published, outside. */
function faceOf(decl: NamespaceDecl, outer: Scope): Record<string, unknown> {
  const inside = outer.child();
  for (const held of decl.decls) if (!heldByANamespace(held)) throw noPlaceFor(held);
  claim(decl, inside);
  for (const held of decl.decls) {
    if (isFnDecl(held)) inside.set(held.name, decorateCallable(held, closureOfDecl(held, inside)));
  }
  bindDeclaredNamespaces(decl.decls, inside);
  for (const held of decl.decls) {
    if (isLetStmt(held)) binderFor(held)(evaluate(held.value, inside), inside);
  }
  return published(decl, inside);
}

/**
 * What the block holds and this cannot place, said rather than skipped.
 *
 * The checker refuses it where it is written. This is the backstop for a host
 * that runs without one, so a `flow` inside a namespace can never again be
 * dropped in silence and counted as a suite that passed.
 */
function noPlaceFor(held: AstNode): ProblemError {
  return new ProblemError({
    ...buildProblem({
      spec: CODES.VN2025_NOT_A_NAMESPACE_MEMBER,
      span: nodeSpan(held, ""),
      title: `A namespace groups names, so it cannot hold ${wordFor(held)}.`,
    }),
    help: "Move it to the top level of the file.",
  });
}

/**
 * Every name the block declares, in the block, before anything is compiled.
 *
 * A function resolves the names it reads to cells once, and a cell nobody has
 * yet is made in the scope that answers for the name. Without this the answer
 * is the file's, so a helper reading a name declared beside it would read a cell
 * the file owns and this scope would fill a different one.
 */
function claim(decl: NamespaceDecl, inside: Scope): void {
  for (const held of decl.decls) {
    const name = (held as { name?: string }).name;
    if (name) inside.set(name, undefined);
  }
}

function published(decl: NamespaceDecl, inside: Scope): Record<string, unknown> {
  const face: Record<string, unknown> = {};
  for (const held of decl.decls) {
    for (const name of exported(held)) face[name] = inside.lookup(name);
  }
  return face;
}

/**
 * What one declaration inside a namespace offers.
 *
 * `pub` and nothing else. A `type` is published too, and holds no value: what a
 * name means to the checker is not something the scope carries, so it is left to
 * the checker and absent here.
 */
function exported(decl: unknown): readonly string[] {
  const marked = decl as { export?: boolean; name?: string };
  if (!marked.export || !marked.name) return [];
  return isFnDecl(decl) || isLetStmt(decl) || isNamespaceDecl(decl) ? [marked.name] : [];
}
