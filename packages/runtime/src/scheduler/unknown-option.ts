import { buildProblem, CODES, type MapEntry, type MapLit, type Problem } from "@venn/core";
import { type ParamSpec, paramSpecs } from "@venn/sdk";
import { nodeSpan } from "./node-span.js";

/**
 * The keys an options map spells that the schema behind it never declared,
 * whether that schema is an action's or a matcher's.
 *
 * One list, two readers: the checker squiggles them before anything runs, the
 * runtime refuses them when the line executes. Same code, same words, so a typo
 * cannot read one way in the editor and another in the terminal.
 *
 * A schema that declares no keys accepts a free-form map, and nothing there is
 * unknown: `grpc.request` takes a `z.record`, `db.seed` takes no schema at all
 * and reads the whole map as table names.
 */
export function unknownOptions(args: {
  opts: MapLit | undefined;
  params: unknown;
  uri: string;
}): Problem[] {
  const specs = paramSpecs(args.params as never);
  if (!args.opts || specs.length === 0 || welcomesMore(args.params)) return [];
  const known = new Set(specs.map((spec) => spec.name));
  return args.opts.entries
    .filter((entry) => !known.has(entry.key))
    .map((entry) => unknownOption({ entry, specs, uri: args.uri }));
}

/**
 * A schema written with a catchall (`z.looseObject`, `.catchall(…)`) names some
 * keys and takes the rest as well. A key it never named is still a key it asked
 * to receive, so there is nothing to report. Read structurally, past the
 * wrappers `.optional()` and `.default()` add, the way {@link paramSpecs} reads
 * the shape.
 */
function welcomesMore(params: unknown): boolean {
  const def = (params as { def?: { catchall?: unknown; innerType?: unknown } } | undefined)?.def;
  if (def?.catchall !== undefined) return true;
  return def?.innerType !== undefined && welcomesMore(def.innerType);
}

function unknownOption(args: {
  entry: MapEntry;
  specs: readonly ParamSpec[];
  uri: string;
}): Problem {
  const { key } = args.entry;
  const hint = nearest(key, args.specs);
  const accepted = args.specs.map((spec) => spec.name).join(", ");
  const title = hint
    ? `"${key}" is not an option here — did you mean "${hint}"?`
    : `"${key}" is not an option here. Accepted: ${accepted}.`;
  return buildProblem({
    spec: CODES.VN3001_UNKNOWN_OPTION,
    span: nodeSpan(args.entry, args.uri),
    title,
  });
}

/** The closest accepted key, when one is close enough to be worth suggesting. */
function nearest(key: string, specs: readonly ParamSpec[]): string | undefined {
  const scored = specs
    .map((spec) => ({ name: spec.name, distance: distance(key, spec.name) }))
    .sort((left, right) => left.distance - right.distance)[0];
  return scored && scored.distance <= Math.max(2, Math.floor(key.length / 2))
    ? scored.name
    : undefined;
}

/** Levenshtein, small enough to keep here and precise enough for a "did you mean". */
function distance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}
