import {
  buildProblem,
  CODES,
  type Document,
  isPackageSpecifier,
  isValueImport,
  nearestName,
  type Problem,
  type ValueImport,
} from "@venn-lang/core";
import type { Registry } from "../registry/index.js";
import { nodeSpan } from "../scheduler/index.js";

/**
 * An import whose path names no package the run loaded.
 *
 * `import { fs } from "venn/fs"` before there was a `venn/fs` exited zero with
 * no output at all. The name bound nothing, and the first use of it failed with
 * `This value is not a function, so it cannot be called: object`, which carries
 * no location and never mentions the path. A reader looking for a filesystem
 * got a green light on the import, believed the namespace existed, and was then
 * sent somewhere else entirely.
 *
 * Only a path in a family some loaded package already claims is refused, so an
 * npm dependency this run resolves by other means is not this check's business.
 * The candidate set for the suggestion is the same list, so it grows the moment
 * a plugin is registered and is never written down twice.
 *
 * @param args The importing document, its uri, the plugins the run loaded, and
 * the npm modules it resolved, which is empty in a Worker and means nothing.
 * @returns One `VN2028` per path nothing publishes.
 */
export function checkPackageImport(args: {
  document: Document;
  uri: string;
  registry: Registry;
  npm?: ReadonlyMap<string, Record<string, unknown>>;
}): Problem[] {
  const loaded = args.registry.packages();
  const families = new Set(loaded.map(familyOf));
  const phantom = (spec: string): boolean =>
    families.has(familyOf(spec)) && !args.registry.plugin(spec) && !args.npm?.has(spec);
  return args.document.imports
    .filter((decl): decl is ValueImport => isValueImport(decl) && isPackageSpecifier(decl.path))
    .filter((decl) => phantom(decl.path))
    .map((decl) => refuse({ decl, uri: args.uri, loaded }));
}

/** What a family of packages shares: `venn` in `venn/io`, and `zod` in `zod`. */
function familyOf(spec: string): string {
  const slash = spec.indexOf("/");
  return slash < 0 ? spec : spec.slice(0, slash);
}

/** The part that tells one package of a family from another: `io` in `venn/io`. */
function tailOf(spec: string): string {
  return spec.slice(spec.indexOf("/") + 1);
}

function refuse(args: { decl: ValueImport; uri: string; loaded: readonly string[] }): Problem {
  const found = buildProblem({
    spec: CODES.VN2028_NO_SUCH_PACKAGE,
    span: nodeSpan(args.decl, args.uri),
    title: `No package is called "${args.decl.path}".`,
  });
  const near = kindred(args.decl.path, args.loaded);
  return near ? { ...found, help: `Did you mean "${near}"?` } : found;
}

/**
 * The nearest package of the same family, compared on the part that differs.
 *
 * On the whole path the shared `venn/` inflates the length, which loosens the
 * suggester's own bound until it answers on any two names of the right size:
 * `venn/file` reached `venn/date` at the same distance as `venn/fs`, and ties
 * go to load order. Compared on `file` against `date` and `fs`, nothing is near
 * enough and the reader is offered nothing rather than a wrong guess.
 */
function kindred(spec: string, loaded: readonly string[]): string | undefined {
  const kin = loaded.filter((one) => familyOf(one) === familyOf(spec));
  const near = nearestName(tailOf(spec), kin.map(tailOf));
  return near === undefined ? undefined : kin.find((one) => tailOf(one) === near);
}
