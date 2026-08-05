import { CODES, type MapEntry, type MapLit, type Problem } from "@venn-lang/core";
import { paramSchema } from "@venn-lang/sdk";
import { optionRefusal, unknownOptions } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";
import { UNKNOWABLE, writtenValue } from "./written-value.js";

/**
 * Check an options map against the action's own schema: the keys it spells and
 * the values it writes there.
 *
 * The runtime refuses both too, but only when the flow reaches that line. Both
 * read the same schema and say the same sentence, so a mistake is marked in the
 * editor before anything runs. Only the keys were checked here until `venn
 * check` was found to exit 0 with "no problems found" on five programs `venn
 * run` refused on their first line.
 */
export function checkOptions(args: {
  opts: MapLit | undefined;
  params: unknown;
  ctx: CheckContext;
}): Problem[] {
  const { opts, params, ctx } = args;
  const unknown = unknownOptions({ opts, params, uri: ctx.uri });
  if (unknown.length > 0 || !opts) return unknown;
  return opts.entries.flatMap((entry) => refusedValue(entry, params, ctx));
}

/**
 * A written value its own key's schema will not take.
 *
 * A spread has no written key, and a value reaching for a name has no value the
 * checker can know: both are the run's to hold to anything, and guessing here
 * would squiggle the innocent. A written `null` is neither of those. It is a
 * value, the schemas refuse it, and reading it as "cannot be known" was the one
 * thing `venn check` still let past that `venn run` stops on.
 */
function refusedValue(entry: MapEntry, params: unknown, ctx: CheckContext): Problem[] {
  if (entry.key === undefined) return [];
  const schema = paramSchema(params, entry.key);
  if (!schema) return [];
  const value = writtenValue(entry);
  if (value === UNKNOWABLE) return [];
  const said = optionRefusal({ key: entry.key, schema, value });
  return said
    ? [problemAt({ node: entry, ctx, spec: CODES.VN3010_TYPE_MISMATCH, title: said })]
    : [];
}
