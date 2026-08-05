import type { CheckContext } from "./check.types.js";

/**
 * Whether the head of a dotted path is a plugin namespace here.
 *
 * One answer for every check that asks, because they used to disagree. The
 * call paths demanded the file's `import` and the value path did not, so
 * `let a = io.args` ran, `print io.args` asked for `io.args()` under VN2008,
 * and `io.args()` was then refused under VN2007: three verdicts on one
 * expression, and no spelling that satisfied all of them. Every run loads every
 * plugin, so the import never decided whether the name resolved, only whether
 * the checker would admit that it had.
 *
 * A name the file binds wins over a namespace of the same spelling, whatever
 * the registry knows: `import { data } from "./mine.vn"` makes `data.thing()` a
 * method on a value, and `venn/data`'s verbs are no answer about it.
 *
 * @param head The name in front of the first dot, exactly as it is written.
 * @param ctx The document's resolved context.
 * @returns True when the registry answers for what hangs off this name.
 */
export function namesANamespace(head: string, ctx: CheckContext): boolean {
  if (ctx.imported.has(head)) return true;
  if (ctx.declared.has(head)) return false;
  return ctx.registry.hasNamespace(head);
}
