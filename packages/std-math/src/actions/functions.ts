import { type ActionDefinition, arg, defineAction } from "@venn-lang/sdk";
import { t } from "@venn-lang/types";

const of = (value: unknown): number => Number(value ?? 0);

/** One function of one number, which is most of what trigonometry is. */
function unary(name: string, doc: string, run: (value: number) => number): ActionDefinition {
  return defineAction({
    name,
    doc,
    args: [arg("value", t.number, "The number to work on.")],
    result: t.number,
    run: (_ctx, input) => run(of(input.args[0])),
  });
}

function binary(
  name: string,
  doc: string,
  names: [string, string],
  run: (a: number, b: number) => number,
): ActionDefinition {
  return defineAction({
    name,
    doc,
    args: [arg(names[0], t.number, "The first."), arg(names[1], t.number, "The second.")],
    result: t.number,
    run: (_ctx, input) => run(of(input.args[0]), of(input.args[1])),
  });
}

/**
 * The functions a number has no member for.
 *
 * `abs`, `floor`, `ceil`, `round`, `sign`, `sqrt`, `pow` and `clamp` are members
 * already: they read better as `x.abs` than as `math.abs(x)`, and a second
 * spelling would be a second way to say one thing. What is here is what is left.
 */
export const functions: ActionDefinition[] = [
  unary("sin", "The sine of an angle in radians.", Math.sin),
  unary("cos", "The cosine of an angle in radians.", Math.cos),
  unary("tan", "The tangent of an angle in radians.", Math.tan),
  unary("asin", "The angle in radians whose sine is this.", Math.asin),
  unary("acos", "The angle in radians whose cosine is this.", Math.acos),
  unary("atan", "The angle in radians whose tangent is this.", Math.atan),
  unary("log", "The natural logarithm.", Math.log),
  unary("log2", "The logarithm base 2.", Math.log2),
  unary("log10", "The logarithm base 10.", Math.log10),
  unary("exp", "`e` raised to this power.", Math.exp),
  unary("degrees", "The same angle in degrees, given radians.", (value) => (value * 180) / Math.PI),
  unary("radians", "The same angle in radians, given degrees.", (value) => (value * Math.PI) / 180),
  binary(
    "atan2",
    "The angle to the point, which is what `atan` cannot tell alone.",
    ["y", "x"],
    Math.atan2,
  ),
  binary(
    "hypot",
    "The hypotenuse, without the overflow of squaring first.",
    ["a", "b"],
    Math.hypot,
  ),
  unary(
    "trunc",
    "The whole part, thrown toward zero. Unlike `floor`, which goes down.",
    Math.trunc,
  ),
  unary("cbrt", "The cube root.", Math.cbrt),
  unary("sinh", "The hyperbolic sine.", Math.sinh),
  unary("cosh", "The hyperbolic cosine.", Math.cosh),
  unary("tanh", "The hyperbolic tangent.", Math.tanh),
  unary("factorial", "The product of every whole number up to this one.", factorial),
  binary(
    "min",
    "The smaller of two. A list already answers `.min` about itself.",
    ["a", "b"],
    Math.min,
  ),
  binary("max", "The larger of two.", ["a", "b"], Math.max),
  binary("gcd", "The greatest common divisor.", ["a", "b"], gcd),
  binary("lcm", "The least common multiple.", ["a", "b"], (a, b) =>
    a && b ? Math.abs(a * b) / gcd(a, b) : 0,
  ),
];

/** Whole numbers only, and nothing at all below zero, where it has no meaning. */
function factorial(value: number): number {
  const whole = Math.trunc(value);
  if (whole < 0) return Number.NaN;
  let total = 1;
  for (let at = 2; at <= whole; at += 1) total *= at;
  return total;
}

/** Euclid's, which is the whole of it. */
function gcd(a: number, b: number): number {
  let [x, y] = [Math.abs(Math.trunc(a)), Math.abs(Math.trunc(b))];
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}
