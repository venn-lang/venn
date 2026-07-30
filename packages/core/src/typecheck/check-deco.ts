import { walkAst } from "../ast/index.js";
import { buildProblem, CODES } from "../codes/index.js";
import { acceptedKinds, readSignature, spanOf, wrongKind } from "../expand/index.js";
import type { Annotation, DecoDecl, Document, Expr, Param } from "../generated/ast.js";
import { isAnnotation, isDecoDecl } from "../generated/ast.js";
import type { Problem } from "../problem/index.js";
import { checkBlock } from "./check-stmts.js";
import { expect, type Infer, inferExpr } from "./infer.js";
import { mono } from "./scheme.js";
import { DYNAMIC, type Type } from "./type.types.js";
import { emptyEnv, type TypeEnv } from "./type-env.js";
import { typeRefToType } from "./type-ref.js";

/**
 * A `deco`'s body, checked the way a `fn`'s is.
 *
 * The kind on the first parameter is a real type, so the body holds a typed
 * handle: hovering `target` says `Fn`, completing `target.` offers what an `Fn`
 * offers, and the checker knows what `target.params` is without anyone teaching
 * it a second vocabulary.
 */
export function checkDecoBody(decl: DecoDecl, env: TypeEnv, infer: Infer): void {
  let scope = env;
  for (const param of decl.params?.params ?? []) {
    const type = decoParamType(param, infer);
    infer.types?.set(param, type);
    // A `deco` takes its arguments by name, and says so where the signature is
    // read; a pattern here binds nothing rather than binding something wrong.
    if (param.name) scope = scope.with(param.name, mono(type));
  }
  checkBlock(decl.body, scope, infer);
}

/**
 * What a `deco`'s parameter is.
 *
 * An unwritten one stays `dynamic` rather than an open question: a decorator's
 * arguments arrive from every `@name(…)` in the file, and letting the first use
 * decide for all of them would turn the second into an error nobody made.
 */
function decoParamType(param: Param, infer: Infer): Type {
  if (!param.paramType) return DYNAMIC;
  const { ctx, named, catalog } = infer;
  return typeRefToType({ ref: param.paramType, ctx, named, catalog });
}

/**
 * What a document's `deco`s answer for statically: a signature that reads, and
 * arguments that match it.
 *
 * The signature is read with the very reader expansion uses, so the sentence
 * `venn check` prints is the sentence a run prints. Expansion does not happen
 * here (the checker looks at the program as written), which is why the signature
 * is read twice, and read the same.
 */
export function checkDecos(args: { document: Document; infer: Infer; uri: string }): Problem[] {
  const problems: Problem[] = [];
  for (const decl of args.document.decls.filter(isDecoDecl)) {
    const read = readSignature(decl);
    if (!read.ok) problems.push(signatureProblem(decl, read.title, args.uri));
  }
  return [...problems, ...checkUses({ ...args, declared: args.infer.decos ?? new Map() })];
}

/**
 * Every `deco` a use site in this file could name, local or imported, keyed by
 * the name an `@` writes. Only the ones whose signature reads, since a use of a
 * broken one has nothing to be checked against.
 *
 * An imported one contributes no VN2015 of its own: that is the other file's
 * fault, reported when the other file is checked, and a span into a document
 * this run never opened would point nowhere.
 */
export function decosInReach(args: {
  document: Document;
  imported?: ReadonlyMap<string, { readonly decl: DecoDecl }>;
}): Map<string, DecoDecl> {
  const found = new Map<string, DecoDecl>();
  for (const [name, from] of args.imported ?? []) {
    if (readSignature(from.decl).ok) found.set(name, from.decl);
  }
  for (const decl of args.document.decls.filter(isDecoDecl)) {
    if (readSignature(decl).ok) found.set(decl.name, decl);
  }
  return found;
}

function signatureProblem(decl: DecoDecl, title: string, uri: string): Problem {
  return buildProblem({ spec: CODES.VN2015_DECO_SIGNATURE, span: spanOf(decl, uri), title });
}

/** Everything a use site needs to be checked against the `deco` it names. */
interface Uses {
  document: Document;
  infer: Infer;
  uri: string;
  declared: ReadonlyMap<string, DecoDecl>;
}

function checkUses(args: Uses): Problem[] {
  if (args.declared.size === 0) return [];
  const problems: Problem[] = [];
  for (const node of walkAst(args.document)) {
    if (isAnnotation(node)) problems.push(...checkUse(node, args));
  }
  return problems;
}

/**
 * `@retry(3)` against `deco retry(target: Flow, times: number)`: is it on
 * something it decorates, and were it given what it asks for.
 */
function checkUse(annotation: Annotation, args: Uses): Problem[] {
  const decl = args.declared.get(annotation.name);
  if (!decl) return [];
  const wrong = misplaced(annotation, decl, args.uri);
  return wrong ? [wrong] : checkArgs(annotation, decl, args);
}

/**
 * The very refusal expansion would make, made while the file is still open.
 *
 * A run reaches it too, and with the same sentence, because both ask
 * {@link wrongKind}. `venn check` never expands, so this is the only place the
 * type error a signature exists to produce reaches an editor.
 */
function misplaced(annotation: Annotation, decl: DecoDecl, uri: string): Problem | undefined {
  const node = annotation.$container;
  const title = node && wrongKind({ name: annotation.name, kinds: acceptedKinds(decl), node });
  if (!title) return undefined;
  const spec = CODES.VN2014_DECORATOR_TARGET;
  return buildProblem({ spec, span: spanOf(annotation, uri), title });
}

/**
 * The arguments are read against an empty scope on purpose: they are part of the
 * shape of the program and not of its execution, so nothing exists yet for a
 * name inside one to refer to. That is the same reason a bare word there is a
 * word and not a variable.
 */
function checkArgs(annotation: Annotation, decl: DecoDecl, args: Uses): Problem[] {
  const params = (decl.params?.params ?? []).slice(1);
  const given = annotation.args?.args ?? [];
  if (given.length !== params.length) {
    return [arityProblem({ annotation, params, given, uri: args.uri })];
  }
  for (const [at, arg] of given.entries()) checkArg(arg.value, params[at], args.infer);
  return [];
}

function checkArg(value: Expr, param: Param | undefined, infer: Infer): void {
  if (!param) return;
  expect(infer, value, inferExpr(value, emptyEnv(), infer), decoParamType(param, infer));
}

function arityProblem(args: {
  annotation: Annotation;
  params: readonly Param[];
  given: readonly unknown[];
  uri: string;
}): Problem {
  const title = arityTitle(args.annotation.name, args.params.length, args.given.length);
  return buildProblem({
    spec: CODES.VN3017_DECO_ARGUMENTS,
    span: spanOf(args.annotation, args.uri),
    title,
  });
}

function arityTitle(name: string, want: number, got: number): string {
  return `@${name} takes ${wanted(want)}, and was given ${got === 0 ? "none" : got}.`;
}

function wanted(count: number): string {
  return count === 0 ? "no arguments" : `${count} argument${count === 1 ? "" : "s"}`;
}
