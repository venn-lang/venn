import { type ZodType, z } from "zod";
import { unitBase } from "./unit-literal.js";

const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000 };

/** `"30s"`, `"1.5h"`. The suffixes are exactly the keys of {@link UNIT_MS}. */
const TEXT = /^([0-9]+(?:\.[0-9]+)?)(ms|s|m|h)$/;

/**
 * The language's own `30s`, which reaches a plugin as `{ kind: "duration", ms }`.
 *
 * Told by shape rather than by the word alone, so an ordinary map somebody
 * wrote as `{ kind: "duration", label: "x" }` is not read as a length of time.
 *
 * A non-finite `ms` is refused here even though `unitBase` recognises it, for
 * the same reason `z.number()` refuses `Infinity`: `1s / 0` is still a duration
 * to a renderer, and is no bound at all to a clock.
 */
const LITERAL = z.custom<{ kind: "duration"; ms: number }>((value) =>
  Number.isFinite(unitBase(value, "duration")),
);

function parseDuration(input: unknown): number {
  if (typeof input === "number") return input;
  const ms = unitBase(input, "duration");
  if (ms !== undefined) return ms;
  const match = TEXT.exec(String(input));
  // Unreachable through the schema, whose string arm already held the text to
  // TEXT. Kept so a direct call cannot quietly answer NaN.
  if (!match) throw new Error(`Invalid duration: "${String(input)}"`);
  return Number(match[1]) * (UNIT_MS[match[2] as string] as number);
}

/**
 * A Zod schema for durations. Accepts the language's own `30s` literal, the
 * text `"30s"`, or a plain number of milliseconds, and yields milliseconds.
 *
 * The literal is accepted here rather than in the compiler because a plugin
 * package may never import `@venn-lang/core`: this is the one place the SDK
 * knows the shape, and `duration-agrees.test.ts` in the runtime holds it
 * against what the compiler produces.
 *
 * A bare number stays a bare number on the way out. Six option keys across
 * three plugins publish themselves to the checker as `t.number` and read what
 * comes back as one, so widening the input is free and widening the output is
 * not.
 *
 * Annotated as `ZodType<number>` by hand because `isolatedDeclarations` cannot
 * infer the transform's output type.
 *
 * @throws ZodError when the value is none of the three: a string with no unit
 * or a unit outside ms/s/m/h is refused by the schema, not by a thrown `Error`,
 * so the runtime can turn it into a sentence about the option that failed.
 */
export const Duration: ZodType<number> = z
  .union([z.string().regex(TEXT), z.number(), LITERAL])
  .transform((value) => parseDuration(value))
  .meta({ venn: "duration" }) as unknown as ZodType<number>;
