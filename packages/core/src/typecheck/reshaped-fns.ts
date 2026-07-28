import { walkAst } from "../ast/index.js";
import { decoTarget } from "../expand/index.js";
import type { DecoDecl, Document, FnDecl } from "../generated/ast.js";
import * as ast from "../generated/ast.js";

/**
 * The verbs that change what a call to a function looks like.
 *
 * `rename` is absent: it moves the name rather than the shape, and the checker
 * has no better answer for the new name than it had for the old one.
 */
const RESHAPING: readonly string[] = ["addParam", "removeParam", "wrap"];

/**
 * The functions a `deco` gives a different shape to.
 *
 * The checker reads the program as written, before expansion has run, so a
 * function that `@inject("who")` gave a parameter to still looks like the one
 * the author typed and every call passing that parameter looks wrong. It is not:
 * the program runs. Inference cannot know the new shape without expanding, so
 * for these it says `dynamic` and stops pinning a signature that is about to
 * change, rather than rejecting a program that works.
 *
 * Narrow on purpose: only a function actually carrying a decorator that
 * actually reshapes. Everything else keeps every check it had.
 */
export function reshapedFns(args: {
  document: Document;
  decos: ReadonlyMap<string, DecoDecl>;
}): ReadonlySet<FnDecl> {
  const found = new Set<FnDecl>();
  const names = reshapingNames(args.decos);
  if (names.size === 0) return found;
  for (const decl of args.document.decls) {
    if (ast.isFnDecl(decl) && decl.annotations.some((one) => names.has(one.name))) found.add(decl);
  }
  return found;
}

/** The decorators in reach whose body changes the shape of what it is applied to. */
function reshapingNames(decos: ReadonlyMap<string, DecoDecl>): Set<string> {
  const names = new Set<string>();
  for (const [name, decl] of decos) {
    if (reshapes(decl)) names.add(name);
  }
  return names;
}

/**
 * Whether the body reaches for one of those verbs on its target, anywhere.
 * Inside an `if` counts, because the checker cannot know which way it goes.
 */
function reshapes(decl: DecoDecl): boolean {
  const target = decoTarget(decl)?.name;
  if (!target) return false;
  const verbs = RESHAPING.map((verb) => `${target}.${verb}`);
  return walkAst(decl.body).some((node) => ast.isActionCall(node) && verbs.includes(node.target));
}
