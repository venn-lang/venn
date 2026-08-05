import { type AstNode, CODES, type MapEntry, type MapLit, type Problem } from "@venn-lang/core";
import type { ParamSpec } from "@venn-lang/sdk";
import { CONSTRUCT_OPTIONS, outsideItsDomain, strayKeyTitle } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";
import { UNKNOWABLE, writtenValue } from "./written-value.js";

/**
 * The options a `parallel`, a `race` or a `forEach` is written with.
 *
 * The same list the runtime reads, so a typo cannot squiggle one way in the
 * editor and behave another in the terminal. `onError: "collct"` used to check
 * clean and then read as the opposite of the default, and `concurrency: "3"`
 * quietly serialised a suite a stopwatch was the only way to catch.
 */
export function checkConstructOptions(node: AstNode, ctx: CheckContext): Problem[] {
  const specs = CONSTRUCT_OPTIONS[node.$type];
  const opts = (node as { opts?: MapLit }).opts;
  if (!specs || !opts) return [];
  return opts.entries.flatMap((entry) => refuse({ entry, specs, ctx }));
}

function refuse(args: {
  entry: MapEntry;
  specs: readonly ParamSpec[];
  ctx: CheckContext;
}): Problem[] {
  // A spread brings keys nobody wrote here, so there is no written key to call
  // unknown and no literal to hold to a domain. The runtime still reads it.
  if (args.entry.key === undefined) return [];
  const spec = args.specs.find((one) => one.name === args.entry.key);
  const at = { node: args.entry, ctx: args.ctx };
  if (!spec) return [problemAt({ ...at, spec: CODES.VN3001_UNKNOWN_OPTION, title: stray(args) })];
  const written = writtenValue(args.entry);
  const wrong = written === UNKNOWABLE ? undefined : outsideItsDomain(spec, written);
  return wrong ? [problemAt({ ...at, spec: CODES.VN3010_TYPE_MISMATCH, title: wrong })] : [];
}

const stray = (args: { entry: MapEntry; specs: readonly ParamSpec[] }): string =>
  strayKeyTitle(args.entry.key as string, args.specs);
