import { buildProblem, CODES } from "../codes/index.js";
import { formatValue, ProblemError, UNLOCATED } from "../problem/index.js";
import { kindOf } from "../value/index.js";

/** Past this a value in a title stops informing and starts scrolling. */
const SHOWN = 40;

/**
 * The kinds whose value is worth reading in a title.
 *
 * A list or a map is refused for being one, and its contents change nothing
 * about that: the reader needs the shape, which the kind already names, and a
 * whole record pasted into a one-line title buries the operator it is about.
 */
const WORTH_SHOWING: Readonly<Record<string, true>> = {
  bool: true,
  number: true,
  string: true,
  duration: true,
  size: true,
  percent: true,
  instant: true,
};

/**
 * `VN3012` for an operator that has no meaning for the two values it met.
 *
 * This fires on data rather than on source: the checker refuses what it can see
 * the type of, so what reaches here came from a file, a socket or a `dynamic`
 * the program was handed. That makes the two values the whole message. "Cannot
 * be applied to these values" named neither, and the reader was left reasoning
 * backwards from a program that had been working a moment earlier.
 *
 * The kinds are the language's own words, never the host's: `typeof` answers
 * `object` for a list and `undefined` for a member that is not there, and
 * neither is a type a reader can write.
 *
 * @param args.op The operator, as it was written.
 * @param args.left The value on its left.
 * @param args.right The value on its right.
 * @returns The refusal, with no place yet: the compiled node that catches it
 * adds one, because it is the only thing that knows where it was written.
 */
export function operatorRefusal(args: { op: string; left: unknown; right: unknown }): ProblemError {
  const sides = `${operand(args.left)} and ${operand(args.right)}`;
  return new ProblemError(
    buildProblem({
      spec: CODES.VN3012_UNIT_MISMATCH,
      span: UNLOCATED,
      title: `Operator "${args.op}" cannot be applied to ${sides}.`,
    }),
  );
}

/**
 * One side, as its value where the value reads at a glance and as its kind
 * otherwise.
 *
 * Nothing is written `null` on its own, because the value and the kind are the
 * same word and saying it twice reads as two facts.
 */
function operand(value: unknown): string {
  const kind = kindOf(value);
  if (kind === "null") return "null";
  const named = `${kind === "instant" ? "an" : "a"} ${kind}`;
  if (!WORTH_SHOWING[kind]) return named;
  const text = formatValue(value);
  return `${text.length <= SHOWN ? text : `${text.slice(0, SHOWN)}…`} (${named})`;
}
