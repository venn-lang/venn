import { indexValue, memberValue } from "../../expr/member-value.js";
import type { Index, Member } from "../../generated/ast.js";
import type { Compile, Thunk } from "../compile.types.js";

/** `x.member`, with the member name fixed by the source. */
export function compileMember(expr: Member, compile: Compile): Thunk {
  const receiver = compile(expr.receiver);
  const member = expr.member;
  return (env) => memberValue(receiver(env), member);
}

/**
 * `xs[i]` and `m[k]`, read by the same rule `.` is.
 *
 * This had three lines and no fences of its own, so `m["toString"]` handed out
 * a host function while `m.toString` was null. Indexing `null`, or reading past
 * the end, gives `null` rather than throwing, so a missing path along a chain
 * reads as absent instead of stopping the flow.
 */
export function compileIndex(expr: Index, compile: Compile): Thunk {
  const receiver = compile(expr.receiver);
  const key = compile(expr.index);
  return (env) => indexValue(receiver(env), key(env));
}
