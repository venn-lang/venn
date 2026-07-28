import type { ActionCall, Expr } from "../generated/ast.js";

/**
 * The arguments of a call, however it was written.
 *
 * The language spells a call two ways, `conn.close()` with brackets and
 * `http.get "url"` without, and the parser keeps them in different places on
 * the node. They are the same call with the same arguments, so every reader
 * downstream asks here and sees one list.
 */
export function callArgs(call: ActionCall): readonly Expr[] {
  const bracketed = call.call?.args ?? [];
  if (bracketed.length === 0) return call.args;
  return [...bracketed.map((arg) => arg.value), ...call.args];
}
