/**
 * What a package barrel publishes, resolved to where each symbol is declared.
 *
 * A barrel re-exports, and a re-export carries no documentation, so asking
 * whether `index.ts` has a JSDoc block above each line answers nothing: every
 * package would fail on every symbol. The question is whether the declaration
 * at the far end of the chain carries one, and reaching it means following
 * `export *`, `export { a as b } from`, and the plain `export { a }` that is
 * re-exporting something the file imported.
 */
import { relative, resolveFrom, slashed } from "./repo-sources.mjs";

const DECLARED = ["function", "const", "let", "var", "class", "interface", "type", "enum"];

const CLAUSE = /\b(?:import|export)\s+(?:type\s+)?\{[^}]*\}/g;
const blanked = new Map();

/**
 * The file with its brace clauses blanked out, at the same length.
 *
 * `export { createMemoryConsole, type MemoryConsole }` holds a line reading
 * `type MemoryConsole,`, which is a re-export and reads exactly like the
 * declaration of a type. Blanking rather than deleting keeps every index in the
 * blanked text an index into the real one, so the JSDoc above a declaration is
 * still found where it is.
 */
function outsideClauses(text) {
  const had = blanked.get(text);
  if (had) return had;
  const made = text.replace(CLAUSE, (one) => " ".repeat(one.length));
  blanked.set(text, made);
  return made;
}

/** Where a name is declared in this file, as an index into its text. */
export function declarationAt(text, name) {
  const outside = outsideClauses(text);
  for (const kind of DECLARED) {
    const found = new RegExp(
      `^\\s*(?:export\\s+)?(?:declare\\s+)?(?:abstract\\s+)?(?:async\\s+)?${kind}\\s+${name}\\b`,
      "m",
    ).exec(outside);
    if (found) return found.index + found[0].length - found[0].trimStart().length;
  }
  return undefined;
}

/** Every `export ... from "spec"` clause, and every `export *`, in order. */
function reExports(text) {
  return [...text.matchAll(/export\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)].map(
    (one) => ({
      names: bindings(one[2]),
      specifier: one[3],
    }),
  );
}

const stars = (text) =>
  [...text.matchAll(/export\s+\*\s*from\s*["']([^"']+)["']/g)].map((one) => one[1]);

/** `a, b as c` read as the pairs it binds, outward name first. */
function bindings(clause) {
  return clause
    .split(",")
    .map((one) => one.trim().replace(/^type\s+/, ""))
    .filter(Boolean)
    .map((one) => {
      const [inner, outer] = one.split(/\s+as\s+/);
      return { outer: outer ?? inner, inner };
    });
}

/** Every `import { a as b } from "spec"` clause, for a plain `export { b }`. */
function imports(text) {
  return [...text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)].flatMap(
    (one) => bindings(one[1]).map((binding) => ({ ...binding, specifier: one[2] })),
  );
}

/** Every name a plain `export { a, b }` publishes, with no `from` clause. */
function plainExports(text) {
  return [...text.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}\s*(?!from)[;\n]/g)].flatMap((one) =>
    bindings(one[1]),
  );
}

/** Every name declared with `export` right on it. */
function ownExports(text) {
  const kinds = DECLARED.join("|");
  return [
    ...text.matchAll(
      new RegExp(
        `^\\s*export\\s+(?:declare\\s+)?(?:abstract\\s+)?(?:async\\s+)?(?:${kinds})\\s+(\\w+)`,
        "gm",
      ),
    ),
  ].map((one) => ({ outer: one[1], inner: one[1] }));
}

/** Every name a file publishes, following `export *` into the files it names. */
export function publishedBy(file, source, seen = new Set()) {
  if (seen.has(file) || !source.has(file)) return [];
  seen.add(file);
  const text = source.get(file);
  const here = [
    ...ownExports(text),
    ...plainExports(text),
    ...reExports(text).flatMap((one) => one.names),
  ];
  const deeper = stars(text).flatMap((specifier) => {
    const next = resolveFrom({ from: file, specifier, source });
    return next ? publishedBy(next, source, seen) : [];
  });
  return [...new Set([...here.map((one) => one.outer), ...deeper.map((one) => one)])];
}

/**
 * What each clause of a barrel contributes, and which file it came through.
 *
 * {@link publishedBy} flattens a barrel to a set of names, which is the right
 * answer to "what does this package hand out" and the wrong one to "who handed
 * it out": a name published by two modules is one entry either way, and that is
 * the case worth catching.
 *
 * @param file The barrel, as a slashed path.
 * @param source Every source file, by path.
 * @returns One entry per clause, plus one for whatever the barrel declares
 * itself. `specifier` is null for that one. `starred` marks `export *`, which
 * is the clause that can publish a name nobody wrote down here. `target` is the
 * file the clause reads, so a caller can ask where each name really comes from:
 * two clauses carrying one name are two owners only when the declarations
 * behind them differ, and a barrel re-exporting a neighbour's re-export reaches
 * the same declaration twice.
 */
export function contributions(file, source) {
  const text = source.get(file) ?? "";
  const own = [...ownExports(text), ...plainExports(text)].map((one) => one.outer);
  const named = reExports(text).map((one) => ({
    specifier: one.specifier,
    target: resolveFrom({ from: file, specifier: one.specifier, source }),
    names: one.names.map((binding) => binding.outer),
    starred: false,
  }));
  const all = [...named, ...starredClauses(file, source, text)];
  if (own.length === 0) return all;
  return [{ specifier: null, target: file, names: own, starred: false }, ...all];
}

/** Each `export *`, resolved and asked what the file behind it publishes. */
function starredClauses(file, source, text) {
  return stars(text).map((specifier) => {
    const target = resolveFrom({ from: file, specifier, source });
    return { specifier, target, names: target ? publishedBy(target, source) : [], starred: true };
  });
}

/**
 * Where a name published by a file is declared, following the chain outwards.
 *
 * Answers `{ file, name }` when the declaration is in the workspace, and
 * `{ outside: "zod" }` when the chain leaves it, which is a symbol documented
 * where it was written rather than where it is passed on.
 */
export function declarationOf(args, seen = new Set()) {
  const key = `${args.file}#${args.name}`;
  if (seen.has(key) || !args.source.has(args.file)) return undefined;
  seen.add(key);
  const text = args.source.get(args.file);
  if (declarationAt(text, args.name) !== undefined) return { file: args.file, name: args.name };
  return through(args, text, seen);
}

/** The one hop outwards, by whichever clause carries the name. */
function through(args, text, seen) {
  const named = [
    ...reExports(text).flatMap((one) => one.names.map((b) => ({ ...b, specifier: one.specifier }))),
    ...imports(text),
  ];
  const hop = named.find((one) => one.outer === args.name);
  if (hop) return step({ ...args, hop }, seen);
  for (const specifier of stars(text)) {
    const found = step({ ...args, hop: { inner: args.name, specifier } }, seen);
    if (found) return found;
  }
  return undefined;
}

function step(args, seen) {
  const next = resolveFrom({ from: args.file, specifier: args.hop.specifier, source: args.source });
  if (!next) return { outside: args.hop.specifier };
  return declarationOf({ file: next, name: args.hop.inner, source: args.source }, seen);
}

/** Whether the declaration carries a JSDoc block right above it. */
export function documented(text, name) {
  const at = declarationAt(text, name);
  if (at === undefined) return false;
  return text.slice(0, at).trimEnd().endsWith("*/");
}

export { relative, slashed };
