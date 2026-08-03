import { splitCall } from "../ast/index.js";
import type { Expr, MapLit } from "../generated/ast.js";
import type { Infer } from "./infer.js";
import { inferExpr } from "./infer.js";
import type { FnType, Type } from "./type.types.js";
import { DYNAMIC } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { unify } from "./unify.js";

/** A verb call, however it was written: bound to a name, or standing alone. */
export interface CallSite {
  target: string;
  args: readonly Expr[];
  opts?: MapLit;
}

/**
 * What a verb gives back, and what it makes of the arguments on the way.
 *
 * This is where a typed world meets an untyped one. With no signature the result
 * is `dynamic` and nothing is checked, because the language has to keep working
 * with plugins that never say a word about types. With one, the arguments are
 * unified against it, which is how `http.on api req => …` learns that `req` is a
 * request without anyone writing it down.
 */
export function callType(site: CallSite, env: TypeEnv, infer: Infer): Type {
  const signature = infer.catalog?.signatureOf(site.target);
  // The trailing `{ … }` is the options in both spellings, so it is told apart
  // here too. Otherwise `http.get(url, { … })` would line the map up against the
  // URL's parameter and the checker would disagree with the runtime.
  const split = splitCall({ args: site.args, takes: signature?.params.length ?? 0 });
  const args = split.args.map((arg) => inferExpr(arg, env, infer));
  const opts = site.opts ?? split.opts;
  if (opts) inferExpr(opts, env, infer);
  if (!signature) return DYNAMIC;
  applyParams(signature, args);
  return signature.result;
}

/**
 * Line the arguments up with the parameters, quietly.
 *
 * A mismatch here is not reported: the options map, the trailing arguments and
 * the shorthands mean a verb can be called in more shapes than one signature
 * describes. The purpose is to *inform* the argument types, a callback's
 * parameters above all, not to police the call.
 */
function applyParams(signature: FnType, args: readonly Type[]): void {
  const width = Math.min(signature.params.length, args.length);
  for (let at = 0; at < width; at += 1) {
    unify(args[at] as Type, signature.params[at] as Type);
  }
}
