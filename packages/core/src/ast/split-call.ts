import type { Expr, MapLit } from "../generated/ast.js";
import { isMapLit } from "../generated/ast.js";

/** A call's arguments, told apart: what it takes, and what configures it. */
export interface SplitCall {
  args: readonly Expr[];
  opts?: MapLit;
}

/**
 * Tell a verb's positional arguments from its options map.
 *
 * The language spells one call two ways, and the trailing `{ … }` means the
 * same in both: `http.get "url" { headers }` and `http.get("url", { headers })`
 * are the same request. Only the first spelling puts the map somewhere the
 * parser can label, so the second is disambiguated here.
 *
 * A map beyond the declared positionals is the options; a map *within* them is
 * an argument. `db.seed({ users: […] })` passes a map because seeding is what
 * it does, and that must never be read as configuration.
 *
 * @param takes How many positional arguments the verb declares.
 */
export function splitCall(args: readonly Expr[], takes: number): SplitCall {
  const last = args[args.length - 1];
  if (args.length <= takes || !last || !isMapLit(last)) return { args };
  return { args: args.slice(0, -1), opts: last };
}
