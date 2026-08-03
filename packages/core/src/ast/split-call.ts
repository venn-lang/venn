import type { MapLit } from "../generated/ast.js";
import { isMapLit } from "../generated/ast.js";
import type { SplitCall, WrittenCall } from "./split-call.types.js";

/**
 * Tell a verb's positional arguments from its options map.
 *
 * The language spells one call two ways, and the trailing `{ … }` means the
 * same in both: `http.get "url" { headers }` and `http.get("url", { headers })`
 * are the same request. Only the first spelling puts the map somewhere the
 * parser can label, so the second is disambiguated here.
 *
 * Two things make a trailing map the options: sitting beyond the declared
 * positionals, or writing only keys the verb declared as options. Counting on
 * its own was not enough. `mock.respond(201, { body })` fills both declared
 * slots, so the map was read as the second argument and the response came back
 * with its body nested inside another `body`, while `mock.respond 201 { body }`
 * did the right thing, against this function's own promise that the two
 * spellings are one call.
 *
 * A map within the positionals whose keys the verb never declared is still an
 * argument: `db.seed(baseline)` passes a map because seeding is what it does.
 */
export function splitCall(call: WrittenCall): SplitCall {
  const last = call.args[call.args.length - 1];
  if (!last || !isMapLit(last)) return { args: call.args };
  if (call.args.length <= call.takes && !onlyDeclaredKeys(call.options, last)) {
    return { args: call.args };
  }
  return { args: call.args.slice(0, -1), opts: last };
}

/** Whether every key this map writes is one the verb accepts as an option. */
function onlyDeclaredKeys(options: WrittenCall["options"], map: MapLit): boolean {
  if (options === undefined || options === false) return false;
  if (options === true) return map.entries.length > 0;
  const known = new Set(options);
  const written = map.entries.filter((entry) => entry.key !== undefined);
  return written.length === map.entries.length && written.every((one) => known.has(one.key ?? ""));
}
