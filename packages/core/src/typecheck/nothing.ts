import type { Type } from "./type.types.js";
import { union } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * The one place that answers "may this be nothing", and "what is it otherwise".
 *
 * Asked by three: the operator that takes the nothing away (`??` and `||`), the
 * reader of a mismatch that offers the way out, and the guard that narrows a
 * value by comparing it against nothing. Three copies of a question this small
 * drift, and the day one of them learns about a second spelling of nothing the
 * other two are wrong.
 */
export function isNothing(type: Type): boolean {
  const t = prune(type);
  return t.kind === "prim" && t.name === "null";
}

/**
 * The same type with the nothing taken out.
 *
 * @returns The rest of it, or nothing at all when there was no nothing to take,
 * which is how a caller tells "narrowed" from "unchanged".
 */
export function withoutNothing(type: Type): Type | undefined {
  const t = prune(type);
  if (t.kind !== "union") return undefined;
  const kept = t.members.filter((member) => !isNothing(member));
  return kept.length === t.members.length || kept.length === 0 ? undefined : union(kept);
}
