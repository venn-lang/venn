import { PRELUDE_VALUES } from "@venn/core";
import type { Scope } from "../scope/index.js";

/**
 * Put the pure prelude values (`len`, `range`, `pretty`, `str`, `min`…) in the
 * root scope. Being values rather than verbs is what lets them appear in any
 * expression: `xs.take(len(ys))`, `"${pretty(user)}"`.
 */
export function bindPrelude(scope: Scope): void {
  for (const [name, value] of Object.entries(PRELUDE_VALUES)) scope.set(name, value);
}
