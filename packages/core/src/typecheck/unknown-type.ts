import { buildProblem, CODES } from "../codes/index.js";
import type { Document } from "../generated/ast.js";
import { isTypeDecl, isValueImport } from "../generated/ast.js";
import type { Problem } from "../problem/index.js";
import { spanOf } from "../span/index.js";
import { didYouMean, nearestName } from "../suggest/index.js";
import { BUILTIN_TYPES } from "./builtin-types.js";
import { CARRIED_OVER_TYPES } from "./carried-over-types.js";
import { KIND_TYPES } from "./kind-types.js";
import type { NamedTypes } from "./named-types.js";
import type { Type } from "./type.types.js";
import type { UnknownTypeArgs, UnknownTypeName } from "./unknown-type.types.js";

/**
 * A type name the language answers to that the built-in table does not list.
 *
 * That table is what the editor offers, and this is not written on a first
 * file: `error` is what a `catch` binds. It resolves, so it belongs in the list
 * a suggestion is drawn from. `fn` does not: it is a keyword rather than a name,
 * so `x: fn` does not parse and offering it would be a fix that fails.
 */
const ALSO_WRITABLE: readonly string[] = ["error"];

/**
 * Where a reader turns when no name is near enough to be the one meant.
 *
 * `pub type` rather than `type` in the importing clause, because a reader who
 * follows this sentence in order writes `type Order` in one file, imports it
 * from another, and lands on VN2009: it is declared there and not published.
 * A help line that needs a second error to finish it is not a help line.
 */
const HOW_A_TYPE_COMES_TO_EXIST =
  "Declare it with `type` in this file, with `pub type` in another and import " +
  "it, or use a built-in such as `string`, `number` or `bool`.";

/**
 * One problem per annotation naming a type nothing declares.
 *
 * The same VN2018 an unbound value name gets, because a type is a name too, and
 * silence here is worse than silence there: an unknown annotation read as
 * `dynamic`, which switched checking off for whatever it annotated and left the
 * reader believing the file was clean.
 *
 * @param args The file, how a name resolves in it, and what could not resolve.
 * @returns One problem per written name, in the order the names were read.
 */
export function unknownTypeProblems(args: UnknownTypeArgs): Problem[] {
  const known = typeNamesInReach(args);
  const asked = namesAskedFor(args.document);
  const said = new Set<object>();
  const problems: Problem[] = [];
  for (const one of args.ctx.unknownTypes) {
    // Inference reads a `type` body once per file and an annotation once per
    // pass, so the same node can arrive twice for one written mistake.
    if (said.has(one.node) || (!one.name.includes(".") && asked.has(one.name))) continue;
    said.add(one.node);
    problems.push(refusal({ one, known, named: args.named, uri: args.uri }));
  }
  return problems;
}

/**
 * The plain names this file's `import` lines ask for, whatever the other file
 * turned out to publish.
 *
 * A name asked for and not published is VN2009, said once at the import, and
 * that is the sentence that helps: the annotation is not the mistake, the
 * import is. It also keeps the editor honest, because a neighbour the workspace
 * has not read yet publishes nothing *known*, which is not the same as
 * publishing nothing. A qualified `ns.Type` is left out on purpose: the
 * namespace resolved to a record before it got here, so the module WAS read and
 * the half after the dot is really missing.
 */
function namesAskedFor(document: Document): ReadonlySet<string> {
  const asked = new Set<string>();
  for (const decl of document.imports) {
    if (!isValueImport(decl)) continue;
    if (decl.wildcard) asked.add(decl.wildcard);
    for (const one of decl.names) asked.add(one.alias ?? one.name);
  }
  return asked;
}

function refusal(args: {
  one: UnknownTypeName;
  known: readonly string[];
  named: NamedTypes;
  uri: string;
}): Problem {
  const far = reached(args.one.name, args.named);
  return buildProblem({
    spec: CODES.VN2018_UNBOUND_NAME,
    span: spanOf(args.one.node, args.uri),
    title: `Nothing is named "${args.one.name}" here.`,
    help: far ? missingFrom(far) : howOneComesToExist(args.one.name, args.known),
  });
}

/** How far a qualified name got before the namespace ran out of names. */
interface Reached {
  /** The dotted prefix that did resolve. */
  qualifier: string;
  /** What that prefix publishes, for the suggestion. */
  fields: ReadonlyMap<string, Type>;
  /** The step it does not publish. */
  missing: string;
}

/**
 * Walk a qualified name through the namespaces it reads, and stop where it
 * stops. Nothing when there is no qualifier, or when the walk left the records
 * before it ran out of names: then the whole name is what is wrong.
 */
function reached(name: string, named: NamedTypes): Reached | undefined {
  const steps = name.split(".");
  let at = steps.length > 1 ? named.get(steps[0] as string) : undefined;
  for (let step = 1; step < steps.length; step += 1) {
    if (at?.kind !== "record") return undefined;
    const next = at.fields.get(steps[step] as string);
    const qualifier = steps.slice(0, step).join(".");
    if (!next) return { qualifier, fields: at.fields, missing: steps[step] as string };
    at = next;
  }
  return undefined;
}

/** The qualifier is right and the name after it is not, so say which half is which. */
function missingFrom(far: Reached): string {
  const said = `\`${far.qualifier}\` publishes nothing called \`${far.missing}\`.`;
  const near = nearestName(far.missing, far.fields.keys());
  return near ? `${said} ${didYouMean(near)}` : said;
}

/** No qualifier to blame, so the written name itself is the mistake. */
function howOneComesToExist(name: string, known: readonly string[]): string {
  const word = name.split(".").pop() ?? name;
  const near = nearestName(name, known) ?? CARRIED_OVER_TYPES[word.toLowerCase()];
  return near ? didYouMean(near) : HOW_A_TYPE_COMES_TO_EXIST;
}

/** Every type name this file may write: the language's own, its own, its imports. */
function typeNamesInReach(args: UnknownTypeArgs): string[] {
  const own = args.document.decls.filter(isTypeDecl).map((decl) => decl.name);
  return [
    ...Object.keys(BUILTIN_TYPES),
    ...ALSO_WRITABLE,
    ...KIND_TYPES.keys(),
    ...own,
    ...(args.imports?.keys() ?? []),
  ];
}
