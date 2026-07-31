import { defineValue, type ValueDefinition } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

/** One constant, published as what it is rather than as something to call. */
function constant(name: string, value: number, doc: string): ValueDefinition {
  return defineValue({ name, doc, type: t.number, value });
}

/**
 * The numbers that are simply true.
 *
 * A constant has no receiver to hang off, which is the whole reason this
 * namespace exists: `2.sqrt` is a question about a number, and `pi` is not. It
 * is published as a value rather than as a verb with no arguments, so it is
 * written `math.pi` and not `math.pi()`.
 */
export const constants: ValueDefinition[] = [
  constant("pi", Math.PI, "The ratio of a circle's circumference to its diameter."),
  constant("tau", Math.PI * 2, "Twice pi, which is the one turn a circle actually makes."),
  constant("e", Math.E, "The base of the natural logarithm."),
  constant(
    "infinity",
    Number.POSITIVE_INFINITY,
    "Larger than every number. What dividing by zero gives.",
  ),
  constant(
    "nan",
    Number.NaN,
    "Not a number: what an impossible sum answers with, and never equals itself.",
  ),
  constant(
    "epsilon",
    Number.EPSILON,
    "The smallest difference between 1 and the next number after it. What `closeTo` is for.",
  ),
];
