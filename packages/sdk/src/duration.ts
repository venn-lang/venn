import { type ZodType, z } from "zod";

const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000 };

function parseDuration(input: string | number): number {
  if (typeof input === "number") return input;
  const match = /^([0-9]+(?:\.[0-9]+)?)(ms|s|m|h)$/.exec(input);
  if (!match) throw new Error(`Invalid duration: "${input}"`);
  return Number(match[1]) * (UNIT_MS[match[2] as string] as number);
}

/**
 * A Zod schema for durations. Accepts `"30s"`, `"2m"` or a plain number of
 * milliseconds, and yields milliseconds.
 *
 * Annotated as `ZodType<number>` by hand because `isolatedDeclarations` cannot
 * infer the transform's output type.
 *
 * @throws Error when a string carries no unit or a unit outside ms/s/m/h.
 */
export const Duration: ZodType<number> = z
  .union([z.string(), z.number()])
  .transform((value) => parseDuration(value)) as unknown as ZodType<number>;
