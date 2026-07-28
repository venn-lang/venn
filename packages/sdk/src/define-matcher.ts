import type { ZodType, z } from "zod";
import type { ArgSpec } from "./schema/args.types.js";
import type { MatcherArgs } from "./types/context.types.js";
import type { MatcherDefinition, MatcherDetail } from "./types/matcher.types.js";

/**
 * Define a matcher: a word usable after `expect`, with its own failure message.
 *
 * @param def Name, the subject type it applies to, params schema, argument names,
 * and the `test` / `message` / `detail` hooks.
 * @returns The definition object the registry ingests.
 */
export function defineMatcher<S extends ZodType = ZodType>(def: {
  name: string;
  /** The subject type this matcher reads, by short name: `Response`, `Element`. */
  appliesTo?: string;
  params?: S;
  /** The positional arguments: `expect x contains value`. */
  args?: readonly ArgSpec[];
  test(args: MatcherArgs<z.infer<S>>): boolean | Promise<boolean>;
  message(args: MatcherArgs<z.infer<S>>): string;
  /** The two sides compared, so the failure carries a diff and not just prose. */
  detail?(args: MatcherArgs<z.infer<S>>): MatcherDetail;
}): MatcherDefinition {
  return def as unknown as MatcherDefinition;
}
