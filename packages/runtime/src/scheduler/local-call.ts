import { isCallable, isNamespaceValue, memberValue } from "@venn-lang/core";
import type { Scope } from "../scope/index.js";

/**
 * What a dotted statement target names, when it names something in scope.
 *
 * `conn.close()` and `http.get "url"` are written alike and mean different
 * things: one is a method on a value the program holds, the other a verb a
 * plugin contributes. Only the name can tell them apart, and a name the program
 * bound wins. That is the rule the evaluator already follows for `auth` the
 * variable against `auth` the namespace.
 *
 * Returns undefined whenever this is not that: no such name, a namespace, or a
 * path that leads somewhere uncallable. The caller then treats it as a verb,
 * and an unknown verb reports itself as it always did.
 */
export function localCallee(target: string, scope: Scope): unknown {
  const segments = target.split(".");
  const head = segments[0];
  if (!head) return undefined;
  const root = scope.lookup(head);
  if (root === undefined || isNamespaceValue(root)) return undefined;
  let value: unknown = root;
  for (let at = 1; at < segments.length; at += 1) {
    value = memberValue(value, segments[at] as string);
  }
  return isCallable(value) ? value : undefined;
}
