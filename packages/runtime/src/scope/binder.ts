import type { BindsValue } from "@venn-lang/core";
import { patternSlots, slotValue } from "@venn-lang/core";
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
 * @param site The `let`, parameter or loop variable doing the binding.
 * @returns A function that binds a value in a scope. Binds nothing when the site
 * names nothing, which is what a half-written one looks like.
 */
export function binderFor(site: BindsValue): Binder {
  const name = site.name;
  if (name) return (value, scope) => scope.set(name, value);
  if (!site.pattern) return () => undefined;
  const slots = patternSlots(site.pattern);
  return (value, scope) => {
    for (const bound of slots) scope.set(bound.name, slotValue(value, bound));
  };
}
