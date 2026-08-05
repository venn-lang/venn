import { indexValue, memberValue } from "../../expr/member-value.js";
import type { Index, Member } from "../../generated/ast.js";
import type { Compile, Thunk } from "../compile.types.js";
import { raisedAt } from "./raised-at.js";

/**
 * `x.member`, with the member name fixed by the source.
 *
 * Wrapped, because a member read can now refuse: `"abc".toNumber` is a failure
 * rather than `NaN`, and a failure with no place in it prints without a file or
 * a line. The handler costs nothing on the path that does not throw, and the
 * span is read off the captured node only when one goes past.
 */
export function compileMember(expr: Member, compile: Compile): Thunk {
  const receiver = compile(expr.receiver);
  const member = expr.member;
  return (env) => {
    try {
      return memberValue(receiver(env), member);
    } catch (thrown) {
      throw raisedAt(thrown, expr);
    }
  };
}

/**
 * `xs[i]` and `m[k]`, read by the same rule `.` is.
 *
 * This had three lines and no fences of its own, so `m["toString"]` handed out
 * a host function while `m.toString` was null. Reading past the end gives
 * `null` rather than throwing, so a missing path along a chain reads as absent
 * instead of stopping the flow; a position that is not one, `xs[-1]`, is not
 * absent and does stop it.
 */
export function compileIndex(expr: Index, compile: Compile): Thunk {
  const receiver = compile(expr.receiver);
  const key = compile(expr.index);
  return (env) => {
    try {
      return indexValue(receiver(env), key(env));
    } catch (thrown) {
      throw raisedAt(thrown, expr);
    }
  };
}
