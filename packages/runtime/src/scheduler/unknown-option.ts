import { buildProblem, CODES, type MapEntry, type MapLit, type Problem } from "@venn-lang/core";
import { type ParamSpec, paramSpecs } from "@venn-lang/sdk";
import { nearestName } from "../suggest/index.js";
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
  const specs = declaredKeys(args.params);
  if (!args.opts || specs.length === 0) return [];
  const known = new Set(specs.map((spec) => spec.name));
  // An entry poured in with `...` brings keys nobody wrote here, so there is no
  // written key to call unknown.
  return args.opts.entries
    .filter((entry) => entry.key !== undefined && !known.has(entry.key))
    .map((entry) => unknownOption({ entry, specs, uri: args.uri }));
}

/**
 * The keys a schema declares, or none where every key is welcome.
 *
 * Split out so a call whose options arrived as a value rather than as a written
 * map is held to the same list: the same typo has to read the same way whether
 * it was bound with `const` or written inside a `print`.
 *
 * @param params The verb's or matcher's options schema.
 * @returns One spec per declared key, empty where there is nothing to refuse.
 */
export function declaredKeys(params: unknown): readonly ParamSpec[] {
  const specs = paramSpecs(params as never);
  return welcomesMore(params) ? [] : specs;
}

/**
 * What to say about a key nobody declared, without a written entry to point at.
 *
 * @param key The key the options carried.
 * @param specs What {@link declaredKeys} answered for the schema.
 * @returns The sentence, in the words the written form uses.
 */
export function strayKeyTitle(key: string, specs: readonly ParamSpec[]): string {
  const hint = nearestName(
    key,
    specs.map((spec) => spec.name),
  );
  const accepted = specs.map((spec) => spec.name).join(", ");
  return hint
    ? `"${key}" is not an option here. Did you mean "${hint}"?`
    : `"${key}" is not an option here. Accepted: ${accepted}.`;
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
  return buildProblem({
    spec: CODES.VN3001_UNKNOWN_OPTION,
    span: nodeSpan(args.entry, args.uri),
    title: strayKeyTitle(args.entry.key as string, args.specs),
  });
}
