import {
  closureOfDecl,
  type Document,
  decorateCallable,
  evaluate,
  isFnDecl,
  isLetStmt,
  type LetStmt,
} from "@venn-lang/core";
import { binderFor, type Scope } from "../scope/index.js";

/**
 * Bind every top-level `fn` as a callable closure. Hoisted so a function can be
 * called before its textual position, and so functions may reference each other
 * regardless of order.
 *
 * A `deco` that asked to `wrap` one is honoured here, at the only moment the
 * function becomes a value: the name a caller reaches is already the decorated
 * one, so a middleware cannot be stepped around by calling from somewhere else.
 */
export function bindFunctions(doc: Document, scope: Scope): void {
  for (const decl of doc.decls) {
    if (isFnDecl(decl)) scope.set(decl.name, decorateCallable(decl, closureOfDecl(decl, scope)));
  }
}

/**
 * Bind top-level functions and the plain `const`/`let` globals every flow can
 * read without anything having run yet.
 *
 * Only pure values. One that calls a verb is a statement, and statements run in
 * the prologue, in order and once, before the flows: opening a database is
 * something a program *does*, not something a name quietly is.
 */
export function bindGlobals(doc: Document, scope: Scope): void {
  bindFunctions(doc, scope);
  bindPlainValues(doc, scope);
}

/**
 * The `const`/`let` globals, evaluated where they stand.
 *
 * Separate from the functions because the order matters across files: a function
 * is hoisted and reads its scope when it is *called*, while a value is read now,
 * so anything a value might depend on has to be in place first.
 */
export function bindPlainValues(doc: Document, scope: Scope): void {
  for (const decl of doc.decls) {
    if (isLetStmt(decl) && isPlainValue(decl)) {
      binderFor(decl)(evaluate(decl.value, scope), scope);
    }
  }
}

function isPlainValue(decl: LetStmt): boolean {
  return decl.args.length === 0 && !decl.opts;
}
