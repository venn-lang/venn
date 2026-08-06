import {
  buildProblem,
  CODES,
  type Document,
  isPackageSpecifier,
  isValueImport,
  type Problem,
  type ValueImport,
} from "@venn-lang/core";
import { nodeSpan, publishedBy } from "../scheduler/index.js";

/** What a package offers, however this command came to know it. */
type Surface = Record<string, unknown>;

interface PackageNamesArgs {
  document: Document;
  uri: string;
  /** The modules this run loaded, which is the whole truth and only `venn run` has it. */
  npm?: ReadonlyMap<string, Surface>;
  /** What each package's types declare, which is what a checker may read. */
  packages?: ReadonlyMap<string, Surface>;
}

/**
 * A name asked of an installed package that the package does not have.
 *
 * Two ways to know, and both are read, because the two commands know different
 * things. `venn run` has the module itself. `venn check` must not import a
 * package to answer a question about it, since importing runs whatever the
 * package runs at load, so it reads the types `venn install` derived instead. A
 * package that published no types is unknowable at check time and stays silent
 * there rather than guessing.
 *
 * Until this, the binder found no such name, bound nothing, and every read
 * answered `null`. `import { chunk } from "lodash"` was the everyday shape of
 * it, since a CommonJS namespace holds `default` and nothing else, and both
 * commands called the file clean while the program carried the nothing on.
 *
 * @param args The importing document, its uri, and whichever of the two
 * surfaces the caller has.
 * @returns One `VN2009` per name no package of that path publishes.
 */
export function checkPackageNames(args: PackageNamesArgs): Problem[] {
  const found: Problem[] = [];
  for (const decl of args.document.imports) {
    if (!isValueImport(decl) || !isPackageSpecifier(decl.path)) continue;
    const surface = knownSurface(decl.path, args);
    if (surface) found.push(...absentFrom({ decl, uri: args.uri, surface }));
  }
  return found;
}

/** The module's own names, or the ones its types declare, or nothing knowable. */
function knownSurface(path: string, args: PackageNamesArgs): Surface | undefined {
  const loaded = args.npm?.get(path);
  if (loaded) return publishedBy(loaded);
  const typed = args.packages?.get(path);
  return typed && Object.keys(typed).length > 0 ? typed : undefined;
}

/** One `VN2009` per name the package does not carry. */
function absentFrom(args: { decl: ValueImport; uri: string; surface: Surface }): Problem[] {
  const held = Object.keys(args.surface).length;
  return args.decl.names
    .filter((one) => !(one.name in args.surface))
    .map((one) =>
      buildProblem({
        spec: CODES.VN2009_NOT_EXPORTED,
        span: nodeSpan(args.decl, args.uri),
        title: `"${args.decl.path}" does not publish ${one.name}.`,
        note: `It publishes ${held} other names.`,
      }),
    );
}
