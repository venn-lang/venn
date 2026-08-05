import {
  type ActionCall,
  type Annotation,
  type Arg,
  type AstNode,
  type DecoDecl,
  decoTarget,
  type Expr,
  isActionCall,
  isFnDecl,
  isRef,
  isStringLit,
  walkAst,
} from "@venn-lang/core";
import type { CheckContext } from "./check.types.js";
import type { AddedParams } from "./decorator-params.types.js";

/**
 * The parameters a decorator on an enclosing `fn` could have bound here.
 *
 * `@inject("who")` calls `target.addParam("who")` and the body underneath is
 * written expecting `who`: expansion runs after this check, so the parameter is
 * not in the tree yet and refusing the name would refuse a program that works.
 * Only that name is excused, and only under a decorator whose body reaches for
 * `addParam`: one that only wraps its target binds nothing, so a typo under it
 * is still a typo.
 *
 * @param node Any node, or the declaration a `${…}` was written inside.
 * @param ctx What this file declares and what it can see.
 * @returns The names in reach, and whether a body could not be read at all.
 */
export function paramsADecoratorAdds(node: AstNode, ctx: CheckContext): AddedParams {
  const names = new Set<string>();
  let unreadable = false;
  for (let at: AstNode | undefined = node; at; at = at.$container) {
    if (!isFnDecl(at)) continue;
    for (const annotation of at.annotations) {
      const added = addedBy(annotation, ctx);
      if (added) for (const name of added) names.add(name);
      else unreadable = true;
    }
  }
  return { names, unreadable };
}

/**
 * What one annotation adds, or nothing when its body is out of reach.
 *
 * A decorator written in TypeScript is handed an `ExpandContext`, which has no
 * `addParam` on it: it leaves metadata and can replace the node, never widen
 * the scope a body reads from, so `@retry` excuses nothing. An imported `deco`
 * is the other way round: it can add one, and its body is in a file this pass
 * never parsed, so the body underneath keeps the benefit of the doubt.
 */
function addedBy(annotation: Annotation, ctx: CheckContext): readonly string[] | undefined {
  const decl = ctx.ownDecos.get(annotation.name);
  if (decl) return namesAdded(decl, annotation);
  return ctx.decos.has(annotation.name) ? undefined : [];
}

/** Every `addParam` the body makes on its target, resolved to the name it adds. */
function namesAdded(decl: DecoDecl, annotation: Annotation): readonly string[] | undefined {
  const target = decoTarget(decl)?.name;
  if (!target) return [];
  const names: string[] = [];
  for (const node of walkAst(decl.body)) {
    if (!isActionCall(node) || node.target !== `${target}.addParam`) continue;
    const name = addedName({ decl, annotation, call: node });
    // A name this cannot work out is one the body underneath may be reading.
    if (name === undefined) return undefined;
    names.push(name);
  }
  return names;
}

/**
 * The name one `addParam` adds: the literal as written, or the `deco` parameter
 * the annotation filled in. Anything computed is not decided until it runs.
 */
function addedName(args: {
  decl: DecoDecl;
  annotation: Annotation;
  call: ActionCall;
}): string | undefined {
  const written = args.call.call?.args[0]?.value ?? args.call.args[0];
  if (!written) return undefined;
  if (isStringLit(written)) return literalName(written.value);
  if (isRef(written)) return filledIn(args.decl, args.annotation, written.name);
  return undefined;
}

/**
 * The argument the annotation wrote for a parameter of the `deco`:
 * `@inject("who")` against `deco inject(target: Fn, name: string)` says `name`
 * is `"who"`. The first parameter is the target itself, so the arguments line
 * up one to the left of it.
 */
function filledIn(decl: DecoDecl, annotation: Annotation, param: string): string | undefined {
  const at = (decl.params?.params ?? []).findIndex((one) => one.name === param);
  if (at < 1) return undefined;
  const args = annotation.args?.args ?? [];
  const written = args.find((arg) => arg.name === param)?.value ?? positional(args, at - 1);
  return written && isStringLit(written) ? literalName(written.value) : undefined;
}

/** A named argument is not one of the ones counted from the left. */
function positional(args: readonly Arg[], at: number): Expr | undefined {
  const arg = args[at];
  return arg && !arg.name ? arg.value : undefined;
}

/** A literal with a `${…}` in it is not a name yet, so it is not one this knows. */
function literalName(value: string): string | undefined {
  return value.includes("${") ? undefined : value;
}
