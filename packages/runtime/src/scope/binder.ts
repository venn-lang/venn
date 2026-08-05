import type { BindsValue } from "@venn-lang/core";
import { ProblemError, patternMisfit, patternSlots, slotValue } from "@venn-lang/core";
import type { Scope } from "./scope.types.js";

/** Put a value in scope under whatever the site names. */
export type Binder = (value: unknown, scope: Scope) => void;

/**
 * How to bind one site, worked out once.
 *
 * A pattern's way into the value is settled here rather than on every pass of a
 * loop: `forEach { name } in people` reads the same field a thousand times, and
 * where that field is does not change between them.
 *
 * What does change between them is the value, so the shape is asked per pass:
 * a pattern in this position has to match, and a list of the wrong length is
 * the one thing about a shape that no type could have said in advance.
 *
 * @param site The `let`, parameter or loop variable doing the binding.
 * @returns A function that binds a value in a scope. Binds nothing when the site
 * names nothing, which is what a half-written one looks like.
 * @throws ProblemError `VN3026` when the value is a list of another length.
 */
export function binderFor(site: BindsValue): Binder {
  const name = site.name;
  if (name) return (value, scope) => scope.set(name, value);
  const pattern = site.pattern;
  if (!pattern) return () => undefined;
  const slots = patternSlots(pattern);
  return (value, scope) => {
    const misfit = patternMisfit(pattern, value);
    if (misfit) throw new ProblemError(misfit);
    for (const bound of slots) scope.set(bound.name, slotValue(value, bound));
  };
}
