import type { ZodType } from "zod";
import type { ArgSpec } from "../schema/args.types.js";
import type { MatcherArgs, MatcherContext } from "./context.types.js";

/**
 * The two sides a matcher compared, as values. The kernel turns them into the
 * structured diff a failure prints: a matcher says *what* it looked at, never
 * how that should look on screen.
 */
export interface MatcherDetail {
  expected: unknown;
  actual: unknown;
  /**
   * Whether the two sides correspond field by field. Defaults to yes, which lets
   * an `equals` failure name the field that moved. A membership matcher says no:
   * it held one needle against every item, so lining the needle up with the
   * haystack would report mismatches at positions nobody compared.
   */
  aligned?: boolean;
}

/**
 * A word usable after `expect`, with its own failure message. The registry stores
 * this erased form; authors get typed params from `defineMatcher`.
 */
export interface MatcherDefinition {
  name: string;
  /**
   * The subject type this matcher reads, by short name: `Response`, `Element`.
   * The editor shows it. It does not narrow what the matcher accepts.
   */
  appliesTo?: string;
  params?: ZodType;
  /**
   * What comes between the matcher and its options: `contains "x"`. Named, so
   * the editor can say which value a half-written check is waiting for.
   */
  args?: readonly ArgSpec[];
  test(args: MatcherArgs<unknown>): boolean | Promise<boolean>;
  message(args: MatcherArgs<unknown>, ctx: MatcherContext): string;
  /** What the one-line message summarises. Omit it and the failure has no body. */
  detail?(args: MatcherArgs<unknown>, ctx: MatcherContext): MatcherDetail;
}
