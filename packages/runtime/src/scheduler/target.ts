import { preludeVerbs } from "@venn-lang/prelude";

/**
 * The prelude verbs, carried out here rather than read as values.
 *
 * The list comes from `@venn-lang/prelude`, which is the one place that says
 * what the language brings with it. A verb has somewhere to write to and
 * something to record; the prelude's *values* live in the root scope instead, so
 * they work inside any expression.
 */
export const PRELUDE: ReadonlySet<string> = new Set(preludeVerbs());

/** Split an action target `namespace.action` into parts (no dot ⇒ namespace only). */
export function splitTarget(target: string): { namespace: string; name: string } {
  const dot = target.indexOf(".");
  if (dot < 0) return { namespace: target, name: "" };
  return { namespace: target.slice(0, dot), name: target.slice(dot + 1) };
}

/** Split a target, mapping a `use "…" as h` alias back to its real namespace. */
export function resolveTarget(
  target: string,
  aliases: ReadonlyMap<string, string>,
): { namespace: string; name: string } {
  const { namespace, name } = splitTarget(target);
  return { namespace: aliases.get(namespace) ?? namespace, name };
}
