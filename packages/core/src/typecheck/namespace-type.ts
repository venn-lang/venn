import type { Document, NamespaceDecl } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
// Type-only, so the cycle with `infer.ts` is erased at build.
import type { Infer } from "./infer.js";
import { inferExpr, inferFn } from "./infer.js";
import { mono } from "./scheme.js";
import { DYNAMIC, record, type Type } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";

/**
 * What a `namespace cart { … }` is worth: a record of what it published.
 *
 * The same answer a plugin's namespace and a file's give, because they are the
 * same thing spelled differently: `cart.total` is read off a record either way,
 * and a name the block does not publish is not on it, so reading one is the
 * ordinary mismatch rather than a quiet `null`.
 *
 * What it does not publish is still in reach inside, so the members are typed in
 * a scope holding all of them: a helper beside a published function is private
 * to the file and ordinary to its neighbours.
 */
export function namespaceEnv(document: Document, env: TypeEnv, infer: Infer): TypeEnv {
  let next = env;
  for (const decl of document.decls) {
    if (!ast.isNamespaceDecl(decl)) continue;
    const face = faceOf(decl, next, infer);
    // Recorded against the declaration, which is where an importer reads it and
    // where a hover on the name finds it.
    infer.types?.set(decl, face);
    next = next.with(decl.name, mono(face));
  }
  return next;
}

/** The record a namespace answers to, built from what `pub` marked. */
function faceOf(decl: NamespaceDecl, outer: TypeEnv, infer: Infer): Type {
  const inside = everythingInside(decl, outer, infer);
  const fields = new Map<string, Type>();
  for (const held of decl.decls) {
    const name = published(held);
    if (name) fields.set(name, inside.lookup(name)?.type ?? DYNAMIC);
  }
  return record(fields);
}

/**
 * Every name the block declares, typed, published or not.
 *
 * Two passes over the functions, as the file gets: a name is in scope before its
 * body is read, so two members may call each other whichever way round they are
 * written.
 */
function everythingInside(decl: NamespaceDecl, outer: TypeEnv, infer: Infer): TypeEnv {
  let inside = outer;
  const fns = decl.decls.filter(ast.isFnDecl);
  for (const held of fns) inside = inside.with(held.name, mono(infer.ctx.fresh() as Type));
  for (const held of decl.decls) {
    if (ast.isNamespaceDecl(held))
      inside = inside.with(held.name, mono(faceOf(held, inside, infer)));
    else if (ast.isLetStmt(held) && held.name) {
      inside = inside.with(held.name, mono(inferExpr(held.value, inside, infer)));
    }
  }
  for (const held of fns) inside = inside.with(held.name, mono(inferFn(held, inside, infer)));
  return inside;
}

/** The name one declaration inside a namespace offers, when `pub` marked it. */
function published(decl: unknown): string | undefined {
  const marked = decl as { export?: boolean; name?: string };
  if (!marked.export || !marked.name) return undefined;
  const holds = ast.isFnDecl(decl) || ast.isLetStmt(decl) || ast.isNamespaceDecl(decl);
  return holds ? marked.name : undefined;
}
