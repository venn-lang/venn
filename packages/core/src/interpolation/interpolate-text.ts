import type { EvalEnv } from "../expr/eval-env.types.js";
import { evaluate } from "../expr/evaluate.js";
import { isWaiting } from "../expr/pending.js";
import { compileTemplate } from "./compile-template.js";
import { joinTemplate } from "./join-template.js";
import type { TemplateHole } from "./template.types.js";

/**
 * Fills the `${…}` in text that is not a string literal in the source.
 *
 * A step title is written as a string but reaches the runtime as a plain field
 * on the node, so the compiler never turns it into a thunk. This is that path:
 * the same scanner, the same rules for what a value looks like, evaluated
 * against the scope the text belongs to.
 *
 * @param args The text, and the scope its placeholders read from.
 * @returns The filled text, or a promise for it when a placeholder is still
 * arriving.
 * @throws Nothing. A placeholder naming something absent fills as empty, since
 * failing a step over its own title helps nobody.
 */
export function interpolateText(args: { text: string; env: EvalEnv }): string | Promise<string> {
  const { chunks, holes } = compileTemplate(args.text);
  if (holes.length === 0) return args.text;

  const values = holes.map((hole) => fill(hole, args.env));
  return values.some(isWaiting)
    ? Promise.all(values).then((settled) => joinTemplate(chunks, settled))
    : joinTemplate(chunks, values);
}

/**
 * A placeholder that does not parse, or names something that is not there,
 * fills as empty. In a string that is an error worth reporting, because the
 * value was wanted; in a title it would fail a step that has not run yet.
 */
function fill(hole: TemplateHole, env: EvalEnv): unknown {
  if (hole.expr === undefined) return "";
  try {
    return evaluate(hole.expr, env);
  } catch {
    return "";
  }
}
