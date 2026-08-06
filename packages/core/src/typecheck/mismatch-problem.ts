/**
 * One place where two types could not be made equal, said as a problem.
 *
 * A mismatch is collected far from where it is reported: the reader of an
 * annotation answers with a type and has no place to put a diagnostic, so the
 * checker fills a sink and this turns the sink into sentences at the end. Every
 * choice about how a clash READS is therefore made here and nowhere else.
 */

import { buildProblem, CODES } from "../codes/index.js";
import type { Problem } from "../problem/index.js";
import { spanOf } from "../span/index.js";
import type { TypeMismatch } from "./context.js";
import { helpAboutNothing } from "./nothing-help.js";
import { namedList, showType, showTypes } from "./show.js";
import type { Type } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * A collected mismatch, placed and worded.
 *
 * @param mismatch What the checker found, with whatever it chose to say.
 * @param uri The file, for the span.
 * @returns The problem, under VN3010 unless the mismatch named its own code.
 */
export function mismatchProblem(mismatch: TypeMismatch, uri: string): Problem {
  const built = buildProblem({
    spec: mismatch.code ?? CODES.VN3010_TYPE_MISMATCH,
    span: spanOf(mismatch.node, uri),
    title: titleOf(mismatch),
  });
  const help = mismatch.help ?? wayOut(mismatch);
  return help ? { ...built, help } : built;
}

/** The nothing is only the fault where the two types are otherwise the same. */
function wayOut(mismatch: TypeMismatch): string | undefined {
  if (mismatch.sentence) return undefined;
  return helpAboutNothing(mismatch);
}

/** Some clashes read better as a sentence than as the two types that clashed. */
function titleOf(mismatch: TypeMismatch): string {
  if (mismatch.sentence) return mismatch.sentence;
  if (mismatch.note) return `Type ${showType(mismatch.expected)} ${mismatch.note}.`;
  const apart = fieldsApart(mismatch.expected, mismatch.actual);
  // One name map across both sides, or the alphabet restarts between them and
  // two unrelated variables both print as `a`, which says they are one type.
  const [expected, actual] = showTypes([mismatch.expected, mismatch.actual]);
  if (expected === actual) return sameName(mismatch);
  return apart ?? `Type mismatch: expected ${expected}, found ${actual}.`;
}

/**
 * Two types that print the same, which happens once a name can be printed.
 *
 * A file may declare a `Fn` of its own beside the built-in handle, or two files
 * may each publish a `Sale`. `expected Fn, found Fn` is the worst line the
 * checker can produce: it is true, it names the problem, and a reader cannot
 * act on it. The shapes are what differ, so the shapes are what it says.
 */
function sameName(mismatch: TypeMismatch): string {
  const shown = showTypes([shapeOnly(mismatch.expected), shapeOnly(mismatch.actual)]);
  return `Type mismatch: two different types are both called ${showType(
    mismatch.expected,
  )}: expected ${shown[0]}, found ${shown[1]}.`;
}

/** The same type with its name set aside, so the shapes can be told apart. */
function shapeOnly(type: Type): Type {
  const { named: _, ...shape } = prune(type);
  return shape as Type;
}

/**
 * Two maps named by the fields that differ.
 *
 * Printing both shapes made the reader diff them by eye, and a nested one runs
 * past three hundred characters to say that one word is missing.
 *
 * Only where both sides have fields and the NAMES differ. Where the same names
 * hold different types the types are the answer, and where one side is `{}`
 * there is nothing to diff: the shape itself is the message.
 */
function fieldsApart(expected: Type, actual: Type): string | undefined {
  const want = prune(expected);
  const held = prune(actual);
  if (want.kind !== "record" || held.kind !== "record" || want.open || held.open) return undefined;
  if (want.fields.size === 0 || held.fields.size === 0) return undefined;
  const missing = [...want.fields.keys()].filter((name) => !held.fields.has(name));
  const spare = [...held.fields.keys()].filter((name) => !want.fields.has(name));
  return said(missing, spare);
}

function said(missing: readonly string[], spare: readonly string[]): string | undefined {
  if (missing.length > 0 && spare.length > 0) {
    return `This map is missing ${namedList(missing)}, and has ${namedList(spare)} instead.`;
  }
  if (missing.length > 0) return `This map is missing ${namedList(missing)}.`;
  return spare.length > 0
    ? `This map has ${namedList(spare)}, which the shape does not.`
    : undefined;
}
