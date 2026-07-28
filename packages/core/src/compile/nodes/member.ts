import { memberValue } from "../../expr/member-value.js";
import { isWaiting, whenBothReady } from "../../expr/pending.js";
import type { Index, Member } from "../../generated/ast.js";
import type { Compile, Thunk } from "../compile.types.js";

/** `x.member`, with the member name fixed by the source. */
export function compileMember(expr: Member, compile: Compile): Thunk {
  const receiver = compile(expr.receiver);
  const member = expr.member;
  return (env) => memberValue(receiver(env), member);
}

/**
 * `xs[i]`, reading straight through when neither side is still arriving.
 *
 * Indexing `null` gives undefined rather than throwing, so a missing path along
 * a chain reads as absent instead of stopping the flow.
 */
export function compileIndex(expr: Index, compile: Compile): Thunk {
  const receiver = compile(expr.receiver);
  const key = compile(expr.index);
  return (env) => {
    const target = receiver(env);
    const at = key(env);
    if (!isWaiting(target) && !isWaiting(at)) return elementAt(target, at);
    return whenBothReady(target, at, elementAt);
  };
}

function elementAt(target: unknown, at: unknown): unknown {
  return target == null ? undefined : (target as Record<string, unknown>)[at as string];
}
