/**
 * How a builtin refuses an argument it cannot use.
 *
 * One module for the three sentences, because they are the same decision said
 * three ways and a second copy of any of them would drift. Every one is raised
 * with no place: the compiled node that catches it adds the span, since it is
 * the only thing that knows where the call was written.
 */

import { buildProblem, CODES } from "../codes/index.js";
import { ProblemError, UNLOCATED } from "../problem/index.js";
import { kindOf } from "../value/index.js";
import type { Counted } from "./counted-argument.types.js";

/** Past this a value in a title stops informing and starts scrolling. */
const SHOWN = 30;

/**
 * `VN3016` for an argument that is not a number at all.
 *
 * Only reachable through a `dynamic`: the checker refuses `[1].take("a")` on
 * the signature, so what gets here came from a file, a response or a plugin.
 *
 * @param value Whatever arrived in the position.
 * @param at The verb, the position and its range.
 * @returns The refusal, with no place on it yet.
 */
export function notANumber(value: unknown, at: Counted): ProblemError {
  const kind = kindOf(value);
  const named = kind === "instant" ? "an instant" : `a ${kind}`;
  return refusal({
    spec: CODES.VN3016_NOT_A_NUMBER,
    title: `\`${at.verb}\` needs a ${at.what}, and this is ${named}.`,
  });
}

/**
 * `VN3031` for a number that is not one this position can use.
 *
 * Three sentences and not one, because the three have different answers: a
 * fraction is rounded, a number out of range is a bug in whatever worked it
 * out, and `NaN` is neither and has to say so plainly.
 *
 * @param value The number that arrived, already known to be a number.
 * @param at The verb, the position and its range.
 * @returns The refusal, with no place on it yet.
 */
export function notACount(value: number, at: Counted): ProblemError {
  const spec = CODES.VN3031_ARGUMENT_OUT_OF_RANGE;
  if (!Number.isFinite(value))
    return refusal({ spec, title: `\`${at.verb}\` needs a ${at.what}, and this is ${value}.` });
  if (!Number.isInteger(value))
    return refusal({
      spec,
      title: `\`${at.verb}\` needs a whole ${at.what}, and this is ${value}.`,
      help: "Round it first, with `.floor`.",
    });
  return refusal({ spec, title: outOfRange(value, at), help: smallestThereIs(at) });
}

/**
 * `VN3030` for arithmetic with no number to answer with.
 *
 * @param title The one line, in the reader's terms: what has no answer.
 * @param help The way out, where there is one to name.
 * @returns The refusal, with no place on it yet.
 */
export function noNumericAnswer(title: string, help?: string): ProblemError {
  return refusal({ spec: CODES.VN3030_NO_NUMERIC_ANSWER, title, help });
}

/**
 * `VN3031` for two bounds the wrong way round.
 *
 * `(5).clamp(10, 1)` answered `1`, which is neither bound honoured and reads as
 * a working clamp. There is no number between 10 and 1, so there is no answer.
 *
 * @param verb The member as it is written.
 * @param low The bound written first.
 * @param high The bound written second.
 * @returns The refusal, with no place on it yet.
 */
export function boundsOutOfOrder(verb: string, low: number, high: number): ProblemError {
  return refusal({
    spec: CODES.VN3031_ARGUMENT_OUT_OF_RANGE,
    title: `\`${verb}\` needs its low bound at or below its high bound, and this is ${low} and ${high}.`,
    help: "Write the smaller one first.",
  });
}

/**
 * `VN3031` for an index that is not a position at all.
 *
 * Its own sentence and not the counted one, because a read has no verb to name
 * and because the two answers a reader wants are members rather than a range.
 *
 * @param value The index that arrived.
 * @returns The refusal, with no place on it yet.
 */
export function notAPosition(value: number): ProblemError {
  return refusal({
    spec: CODES.VN3031_ARGUMENT_OUT_OF_RANGE,
    title: `There is no position ${value}.`,
    help: "Positions start at 0. The last one is `xs.last`, the last few `xs.takeLast(n)`.",
  });
}

/**
 * `VN3031` for a step of zero, which never reaches the end of a range.
 *
 * `range(0, 10, 0)` quietly became `range(0, 10, 1)`, so a loop written to walk
 * in tens walked in ones and handed back ten times what it was asked for.
 *
 * @returns The refusal, with no place on it yet.
 */
export function stepOfZero(): ProblemError {
  return refusal({
    spec: CODES.VN3031_ARGUMENT_OUT_OF_RANGE,
    title: "`range` needs a step that is not zero.",
    help: "A step of 1 counts up one at a time, and a step below zero counts down.",
  });
}

/** Whichever ends the position has, said the way a reader would say them. */
function outOfRange(value: number, at: Counted): string {
  return `\`${at.verb}\` needs a ${at.what} ${ends(at)}, and this is ${value}.`;
}

function ends(at: Counted): string {
  if (at.least !== undefined && at.most !== undefined) return `between ${at.least} and ${at.most}`;
  return at.most === undefined ? `of ${at.least} or more` : `of ${at.most} or less`;
}

/**
 * Named only where the floor is one, because that is the case a reader gets
 * wrong: `chunk(0)` used to become `chunk(1)` in silence, and the line that
 * refuses it should say what the smallest real chunk actually is.
 */
function smallestThereIs(at: Counted): string | undefined {
  return at.least === 1 ? `A ${at.what} of 1 is the smallest there is.` : undefined;
}

/** One shape for every refusal here, so the place is added in one spot. */
function refusal(args: {
  spec: (typeof CODES)[keyof typeof CODES];
  title: string;
  help?: string;
}): ProblemError {
  return new ProblemError(
    buildProblem({ spec: args.spec, span: UNLOCATED, title: args.title, help: args.help }),
  );
}

/**
 * `VN3016` for text that does not read as a number.
 *
 * `"abc".toNumber` answered `NaN`, which is a number as far as everything
 * downstream is concerned: it survives `take`, it survives arithmetic, and it
 * reaches the reader as an empty report rather than as a refusal. Text that
 * might not be a number is an ordinary thing to have, so the way out is named
 * on the line rather than left to be discovered.
 *
 * @param text The text as it was, quoted and cut if it is long.
 * @returns The refusal, with no place on it yet.
 */
export function textIsNotANumber(text: string): ProblemError {
  const quoted = text.length <= SHOWN ? text : `${text.slice(0, SHOWN)}…`;
  return refusal({
    spec: CODES.VN3016_NOT_A_NUMBER,
    title: `"${quoted}" is not a number.`,
    help: "It may not be one. Give it a stand-in with `try raw.toNumber else 0`.",
  });
}
