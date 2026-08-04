import {
  type AstNode,
  buildProblem,
  CODES,
  evaluate,
  type MapEntry,
  type MapLit,
  type Problem,
} from "@venn-lang/core";
import type { ParamSpec } from "@venn-lang/sdk";
import {
  CONSTRUCT_OPTIONS,
  nodeSpan,
  outsideItsDomain,
  strayKeyTitle,
} from "../scheduler/index.js";
import { createScope } from "../scope/index.js";
import type { CheckContext } from "./check.types.js";

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
  return opts.entries.flatMap((entry) => refuse({ entry, specs, uri: ctx.uri }));
}

function refuse(args: { entry: MapEntry; specs: readonly ParamSpec[]; uri: string }): Problem[] {
  // A spread brings keys nobody wrote here, so there is no written key to call
  // unknown and no literal to hold to a domain. The runtime still reads it.
  if (args.entry.key === undefined) return [];
  const spec = args.specs.find((one) => one.name === args.entry.key);
  if (!spec) return [problem(args, CODES.VN3001_UNKNOWN_OPTION, stray(args))];
  const wrong = outsideItsDomain(spec, written(args.entry));
  return wrong ? [problem(args, CODES.VN3010_TYPE_MISMATCH, wrong)] : [];
}

const stray = (args: { entry: MapEntry; specs: readonly ParamSpec[] }): string =>
  strayKeyTitle(args.entry.key as string, args.specs);

/**
 * What the entry says, when it says it here.
 *
 * Evaluated against nothing, so a literal answers and anything reaching for a
 * name reads as nothing at all. A value the checker cannot know is one only the
 * runtime can hold to its domain, and guessing at it would squiggle the
 * innocent: `{ concurrency: pool }` is a name, not a mistake.
 */
function written(entry: MapEntry): unknown {
  try {
    return evaluate(entry.value, createScope()) ?? undefined;
  } catch {
    return undefined;
  }
}

function problem(
  args: { entry: MapEntry; uri: string },
  spec: (typeof CODES)[keyof typeof CODES],
  title: string,
): Problem {
  return buildProblem({ spec, span: nodeSpan(args.entry, args.uri), title });
}
