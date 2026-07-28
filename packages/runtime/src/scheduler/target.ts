/**
 * Prelude verbs, callable without `use` (§12). `print` writes to the console,
 * `log` records into the event stream (what a reporter and a test see), and the
 * rest steer the run. Pure prelude *values* (`len`, `range`, `pretty`…) are not
 * here: they live in the root scope, so they work in any expression.
 */
export const PRELUDE: ReadonlySet<string> = new Set([
  "print",
  "log",
  "wait",
  "skip",
  "fail",
  "exit",
]);

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
