import { invoke, readDecorations } from "@venn-lang/core";

/**
 * Run the `.before` and `.after` closures a `deco` left on a flow or a step.
 *
 * The language has no syntax for "around this body", so the verbs leave a fact
 * behind and this is where it is honoured. `.after` runs from a `finally`,
 * because a hook that only runs when nothing went wrong is the one case it was
 * written for.
 */
export async function runAround(node: object, body: () => unknown): Promise<void> {
  const around = readDecorations(node);
  if (!around) {
    await body();
    return;
  }
  for (const fn of around.before) invoke(fn, []);
  try {
    await body();
  } finally {
    for (const fn of around.after) invoke(fn, []);
  }
}
