/**
 * A name two modules of one package both publish through its barrel.
 *
 * The charter says a folder is one responsibility and a name has one owner.
 * Nothing enforced that across an `export *`, and the rule was rediscovered by
 * hand: `kindOf` and `rootOf` both had to be renamed in one epic, and half a
 * session went to the same hazard before that.
 *
 * What TypeScript does here was measured rather than assumed, by injecting each
 * case and running `tsc --noEmit`:
 *
 * - two `export *` publishing two different declarations of one name is TS2308,
 *   for types exactly as for values. The guard reports it first and in plainer
 *   words, but the compiler would have caught it.
 * - a written `export { X } from` beside an `export *` that also publishes `X`
 *   is silent, and always will be: TS2308's own advice is to "consider
 *   explicitly re-exporting to resolve the ambiguity", so the written clause is
 *   the compiler's recommended fix and never its complaint. The written one
 *   wins, and the starred module's name is published by its folder and
 *   unreachable from the package. This is the case the guard exists for, and
 *   the one live example in the tree is exactly it.
 * - one declaration reached by two roads, a folder barrel re-exporting a
 *   neighbour's, is not a collision to anybody and is not reported.
 *
 * Read through {@link contributions} rather than by matching text here, because
 * "what does this barrel publish" already has an owner and a second reading of
 * it is the very thing this file exists to refuse. That reading follows
 * `export *` into the file it names, counts `export type` alongside `export`,
 * and knows a re-export clause from a declaration that looks like one.
 */
import { contributions, declarationOf } from "./barrel-exports.mjs";
import { relative } from "./repo-sources.mjs";

/**
 * Every name a package barrel publishes from more than one place.
 *
 * @param entry The barrel, as a slashed path.
 * @param source Every source file, by path.
 * @returns One entry per collision, in name order: the `name` for a baseline to
 * hold, and `said`, the sentence naming both places it comes from and the fix.
 * Empty when every name the package hands out has exactly one owner.
 */
export function twoOwners(entry, source) {
  const from = new Map();
  for (const clause of contributions(entry, source)) {
    for (const name of clause.names) from.set(name, [...(from.get(name) ?? []), clause]);
  }
  return [...from]
    .filter(([name, where]) => where.length > 1 && !oneDeclaration({ name, where, source }))
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([name, where]) => ({ name, said: said({ entry, name, where }) }));
}

/**
 * Whether every clause carrying this name reaches the same declaration.
 *
 * Two clauses spelling one name are usually not two owners at all: a folder
 * barrel re-exports a neighbour's, and the root reaches one `Span` by two
 * roads. Neither TypeScript nor the ES specification calls that ambiguous, and
 * a guard that did would cry on most of the tree and be turned off. What counts
 * is two different declarations wearing one name.
 *
 * A name whose chain leaves the workspace, or that resolves nowhere, is read as
 * its own answer rather than as a match, so an unresolvable pair is reported
 * rather than waved through.
 */
function oneDeclaration(args) {
  const seen = args.where.map((clause) => {
    const at =
      clause.target && declarationOf({ file: clause.target, name: args.name, source: args.source });
    return at?.file ? `${at.file}#${at.name}` : `unresolved:${clause.specifier}`;
  });
  return new Set(seen).size === 1;
}

/**
 * The sentence a collision gets, in the words that say what to do about it.
 *
 * The two kinds send a reader to different places, so they are said
 * differently. Two stars are ambiguous and the compiler will say so too, in
 * TS2308's vocabulary. A star against a written clause is not ambiguous at all,
 * which is the worse case: the written one wins, nothing anywhere reports it,
 * and the other module's name never leaves the package.
 */
function said(args) {
  const places = args.where.map(where).join(" and ");
  const quiet = args.where.some((one) => !one.starred);
  const trouble = quiet
    ? "and the written one wins in silence, so the other never leaves the package"
    : "and nothing here chooses between them";
  return `${relative(args.entry)} publishes \`${args.name}\` from ${places}, ${trouble}. Rename one of them, or re-export the one you meant by name.`;
}

/** A clause named as a reader would look for it. */
function where(clause) {
  return clause.specifier ? `\`${clause.specifier}\`` : "its own declarations";
}
