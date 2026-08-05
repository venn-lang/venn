/**
 * A pure call standing alone, whose answer nothing keeps.
 *
 * `rows.push(x)` is the one that cost real time: it reads like JavaScript's
 * mutating method, it compiles, it runs, and it hands back a new list that the
 * statement drops on the floor. A program printed `months: 0` beside a total
 * that was right, with no diagnostic anywhere.
 *
 * Reported as the general rule rather than as a note about `push`, because
 * every member of every built-in table is pure: none of them changes its
 * receiver, so any one of them written as a statement on its own does nothing.
 * That catches `s.trim`, `m.omit("k")` and the rest of the shape at the same
 * time, which renaming one method would not.
 */

import { callArgs } from "../ast/index.js";
import { CODES } from "../codes/index.js";
import type { ActionCall } from "../generated/ast.js";
import { resolveMember } from "./builtins.js";
import type { TypeMismatch } from "./context.js";
import type { Infer } from "./infer.js";
import { instantiate } from "./scheme.js";
import { showType } from "./show.js";
import type { Type } from "./type.types.js";
import type { TypeEnv } from "./type-env.js";
import { prune } from "./unify.js";

/**
 * The kinds whose members cannot reach the world.
 *
 * A handle is left out on purpose: `server.close()` is spelled the same way and
 * is the whole point of holding one.
 */
const PURE_RECEIVERS = new Set(["list", "record", "prim", "literal"]);

/** What the statement threw away, and the name it could have been put back on. */
interface Wasted {
  value: Type;
  receiver: string;
}

/**
 * Say so when a statement made of a member call keeps nothing.
 *
 * @param node The call written as a statement.
 * @param env The scope it stands in, which is what says whether the head of the
 * target is a value or the name of a namespace the run provides.
 * @param infer Where the plugin catalog, the fresh variables and the report go.
 */
export function reportDiscarded(node: ActionCall, env: TypeEnv, infer: Infer): void {
  const kept = keptValue(node, env, infer);
  if (kept === undefined) return;
  const at = { node, expected: kept.value, actual: kept.value };
  infer.ctx.mismatches.push({ ...at, ...saying(node, kept) });
}

/**
 * The words, which are about a copy nobody kept rather than about two types.
 *
 * One way out and not two, because a `fn` body's last expression is its value
 * and the grammar reads it as one, so this never fires in the position where
 * the answer would have been `return` instead.
 */
function saying(node: ActionCall, kept: Wasted): Pick<TypeMismatch, "code" | "sentence" | "help"> {
  return {
    code: CODES.VN5009_DISCARDED_RESULT,
    sentence: `\`${node.target}\` gives back a new ${showType(kept.value)}, and nothing keeps it.`,
    help: `Nothing is changed in place. Bind the result with \`let\`, or assign it back to \`${kept.receiver}\`.`,
  };
}

/** The value the statement throws away, or nothing when it throws none away. */
function keptValue(node: ActionCall, env: TypeEnv, infer: Infer): Wasted | undefined {
  // A verb the run provides is not a member read, whatever the dots look like,
  // and what it gives back is the plugin's business rather than this rule's.
  if (infer.catalog?.signatureOf(node.target)) return undefined;
  const path = node.target.split(".");
  const held = read(path, env, infer);
  if (!held) return undefined;
  const value = answered(held, node);
  return worthKeeping(value) ? { value, receiver: path.slice(0, -1).join(".") } : undefined;
}

/** Walk the dotted target through the member tables, or give up on the first miss. */
function read(path: readonly string[], env: TypeEnv, infer: Infer): Type | undefined {
  const scheme = path.length > 1 ? env.lookup(path[0] as string) : undefined;
  let held = scheme && instantiate(scheme, infer.ctx);
  for (const name of path.slice(1)) {
    const receiver = held && prune(held);
    if (!receiver || !PURE_RECEIVERS.has(receiver.kind)) return undefined;
    held = resolveMember(receiver, name, infer.ctx);
  }
  return held;
}

/** What the statement evaluates to: the call's result, or the member itself. */
function answered(held: Type, node: ActionCall): Type {
  const called = node.called || callArgs(node).length > 0 || node.opts !== undefined;
  const member = prune(held);
  return called && member.kind === "fn" ? prune(member.result) : member;
}

/**
 * Whether dropping it is worth saying anything about.
 *
 * `xs.forEach(…)` answers nothing and is written for what it does, and a value
 * the checker could not work out is not one it can call wasted: over-claiming
 * here would report a correct program.
 */
function worthKeeping(value: Type): boolean {
  if (value.kind === "dynamic" || value.kind === "var") return false;
  return !(value.kind === "prim" && (value.name === "null" || value.name === "void"));
}
