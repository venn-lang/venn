import { buildProblem, CODES } from "../../codes/index.js";
import { isWaiting } from "../../expr/pending.js";
import type { NumberLit, StringLit } from "../../generated/ast.js";
import { compileTemplate, joinTemplate, type TemplateHole } from "../../interpolation/index.js";
import { ProblemError } from "../../problem/index.js";
import { parseInstant, parseNumber } from "../../units/index.js";
import type { Compile, Thunk } from "../compile.types.js";

const NO_SPAN = { uri: "", offset: 0, length: 0, line: 1, column: 1 };

/** A literal is a constant: read the lexeme once, then hand back the value. */
export function constant(value: unknown): Thunk {
  return () => value;
}

export function compileNumber(expr: NumberLit): Thunk {
  return constant(parseNumber(expr.raw));
}

export function compileInstant(expr: { value: string }): Thunk {
  return constant(parseInstant(expr.value));
}

/**
 * A string with no `${…}` is a constant. One with placeholders becomes the
 * literal chunks plus a compiled thunk per hole: the scanning, the parsing and
 * the splitting all happen here, never again.
 */
export function compileString(expr: StringLit, compile: Compile): Thunk {
  const { chunks, holes } = compileTemplate(expr.value);
  if (holes.length === 0) return constant(expr.value);
  const fills = holes.map((hole) => compileHole(hole, compile));
  // Filled in one pass, watching as it goes for a placeholder still arriving.
  // `map` with a continuation reads better but builds two function objects per
  // evaluation, both closing over `env`. The values still land in an array
  // because a hole cannot be evaluated twice: one of them may be an action.
  return (env) => {
    const values = new Array<unknown>(fills.length);
    let waiting = false;
    for (let at = 0; at < fills.length; at += 1) {
      const value = (fills[at] as Thunk)(env);
      waiting = waiting || isWaiting(value);
      values[at] = value;
    }
    return waiting ? settleJoin(chunks, values) : joinTemplate(chunks, values);
  };
}

/** The waiting path: every hole settled, then the same join. */
async function settleJoin(chunks: readonly string[], values: unknown[]): Promise<string> {
  return joinTemplate(chunks, await Promise.all(values));
}

/** A placeholder that does not parse is a mistake worth reporting, not an empty string. */
function compileHole(hole: TemplateHole, compile: Compile): Thunk {
  if (hole.expr) return compile(hole.expr);
  return () => {
    throw new ProblemError(
      buildProblem({
        spec: CODES.VN1002_PARSE,
        span: NO_SPAN,
        title: `Cannot read \`\${${hole.source}}\` — that is not an expression.`,
      }),
    );
  };
}
