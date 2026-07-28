import type { AstNode } from "langium";
import { buildProblem, CODES } from "../codes/index.js";
import type { ImportedDeco } from "../expand/index.js";
import type { Declaration, Document, Expr, FnDecl } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { Problem, Span } from "../problem/index.js";
import type { TypeCatalog } from "./catalog.types.js";
import { checkDecoBody, checkDecos, decosInReach } from "./check-deco.js";
import { checkBlock, checkFragment, checkStatement } from "./check-stmts.js";
import { createContext, type TypeContext, type TypeMismatch } from "./context.js";
import { type Infer, inferFn, type Slot } from "./infer.js";
import { collectNamedTypes } from "./named-types.js";
import { PRELUDE_SPECS } from "./prelude-types.js";
import { reshapedFns } from "./reshaped-fns.js";
import { generalize, mono } from "./scheme.js";
import { seedParams } from "./seed-params.js";
import { seedValues } from "./seed-values.js";
import { showType } from "./show.js";
import { DYNAMIC, type Type } from "./type.types.js";
import { emptyEnv, type TypeEnv } from "./type-env.js";
import { prune, unify } from "./unify.js";

/** What one check of a document produced. */
export interface CheckTypesResult {
  problems: Problem[];
  /** Every expression's inferred type, keyed by node, for hover. */
  types: Map<object, Type>;
  /** Per string literal, the expression parsed from each of its ${…} slots. */
  slots: Map<object, (Expr | undefined)[]>;
}

/** What the checker may be told about the world outside the file. */
export interface CheckTypesOptions {
  uri?: string;
  /** The types and signatures the loaded plugins contribute. */
  catalog?: TypeCatalog;
  /** The `pub deco`s this file's imports reach. Without them an imported
   * `@name` is a name the checker knows nothing about, and says nothing about. */
  decos?: ReadonlyMap<string, ImportedDeco>;
  /** What the names this file imports turned out to be, from the files it names. */
  imports?: ReadonlyMap<string, Type>;
}

/**
 * Infer and check the types across a document.
 *
 * Errors are raised only where a type is actually known. Anything touching
 * `dynamic`, such as a plugin that published no signature or an HTTP response,
 * is left alone, so the checker helps without ever blocking.
 *
 * @returns the problems found, plus the inferred type of every expression and
 * the expressions parsed out of each `${…}`, both of which the editor reads.
 */
export function checkTypes(document: Document, options: CheckTypesOptions = {}): CheckTypesResult {
  const uri = options.uri ?? "memory://inline.vn";
  const ctx = createContext();
  // Shared with the seeding pass: parsing every `${…}` twice is the one part of
  // a second walk that would actually cost something.
  const parsed = new Map<AstNode, Slot[]>();
  const decos = decosInReach({ document, imported: options.decos });
  const shared = { document, catalog: options.catalog, decos, parsed, run: pass };
  const values = seedValues(shared);
  const seeds = seedParams(shared);
  const infer: Infer = {
    ctx,
    named: collectNamedTypes(document, ctx, options.catalog),
    catalog: options.catalog,
    decos,
    seeds,
    values,
    parsed,
    imports: options.imports,
    types: new Map(),
    slots: new Map(),
  };
  pass(document, infer);
  // After the pass, so a decorator's arguments are read once, and before the
  // mismatches are turned into problems, since that is where they land.
  const deco = checkDecos({ document, infer, uri });
  return {
    problems: [...ctx.mismatches.map((m) => problem(m, uri)), ...deco],
    types: infer.types ?? new Map(),
    slots: infer.slots ?? new Map(),
  };
}

/** One walk of the whole document: top-level bindings, then everything that runs. */
function pass(document: Document, infer: Infer): void {
  walk(document, topLevelEnv(document, infer), infer);
}

/**
 * Hoist functions and bind top-level values, so the whole file sees them.
 *
 * Generalising is what makes a helper reusable at more than one type, and also
 * what stops a call site from ever reaching the declaration, since each use gets
 * its own copy. The seeding pass therefore skips it: that pass exists precisely
 * to let the callers speak.
 */
function topLevelEnv(document: Document, infer: Infer): TypeEnv {
  const fns = document.decls.filter(ast.isFnDecl);
  // A decorator may hand this function a shape nobody here can read; its body is
  // still checked, but its signature is not the one callers will meet.
  const reshaped = reshapedFns({ document, decos: infer.decos ?? new Map() });
  const outer = withImports(preludeEnv(), infer);
  let env = withSeededValues(hoist({ fns, reshaped, ctx: infer.ctx, env: outer }), infer);
  for (const decl of fns) {
    const inferred = inferFn(decl, env, infer);
    if (!reshaped.has(decl)) unify(env.lookup(decl.name)?.type ?? placeholder(infer), inferred);
  }
  if (!infer.seeding) env = generalizeFns(fns, env, infer);
  return bindValues(document, env, infer);
}

/**
 * What the file's values hold, put in reach of the function bodies about to be
 * checked. The real binding still happens below, in source order and with the
 * annotations read; this only stops a body from meeting a name it cannot know.
 */
function withSeededValues(env: TypeEnv, infer: Infer): TypeEnv {
  let next = env;
  for (const [name, type] of infer.values ?? []) next = next.with(name, mono(type));
  return next;
}

/**
 * The names this file imported, each with the type its own module gave it.
 *
 * Generalised over everything free in them, for two reasons: a generic helper
 * stays generic across the file boundary, and the variables belonging to the
 * pass that inferred them are replaced with fresh ones here rather than being
 * unified with anything in this file.
 */
function withImports(env: TypeEnv, infer: Infer): TypeEnv {
  let next = env;
  for (const [name, type] of infer.imports ?? []) next = next.with(name, generalize(type, EMPTY));
  return next;
}

const EMPTY: ReadonlySet<number> = new Set();

/** The prelude is in scope everywhere, so inference knows what its verbs return. */
function preludeEnv(): TypeEnv {
  let env = emptyEnv();
  for (const [name, spec] of Object.entries(PRELUDE_SPECS)) env = env.with(name, mono(spec.type));
  return env;
}

function hoist(args: {
  fns: readonly FnDecl[];
  reshaped: ReadonlySet<FnDecl>;
  ctx: TypeContext;
  env: TypeEnv;
}): TypeEnv {
  let next = args.env;
  for (const decl of args.fns) {
    next = next.with(decl.name, mono(args.reshaped.has(decl) ? DYNAMIC : args.ctx.fresh()));
  }
  return next;
}

function generalizeFns(fns: readonly FnDecl[], env: TypeEnv, infer: Infer): TypeEnv {
  let next = env;
  for (const decl of fns) {
    const type = env.lookup(decl.name)?.type;
    if (!type) continue;
    // The declaration carries its own type, so hovering the name shows it.
    infer.types?.set(decl, prune(type));
    next = next.with(decl.name, generalize(prune(type), new Set()));
  }
  return next;
}

function bindValues(document: Document, env: TypeEnv, infer: Infer): TypeEnv {
  let next = env;
  for (const decl of document.decls) {
    if (ast.isLetStmt(decl)) next = checkStatement(decl, next, infer);
  }
  return next;
}

/** Check the executable parts: flows, fragments, and top-level statements. */
function walk(document: Document, env: TypeEnv, infer: Infer): void {
  for (const decl of document.decls) checkDeclaration(decl, env, infer);
}

function checkDeclaration(decl: Declaration, env: TypeEnv, infer: Infer): void {
  if (ast.isFlowDecl(decl)) checkBlock(decl.body, env, infer);
  else if (ast.isFragmentDecl(decl)) checkFragment(decl, env, infer);
  else if (ast.isDecoDecl(decl)) checkDecoBody(decl, env, infer);
  else if (!ast.isFnDecl(decl) && !ast.isLetStmt(decl) && isExecutable(decl)) {
    checkStatement(decl as never, env, infer);
  }
}

function isExecutable(decl: Declaration): boolean {
  return !(ast.isTypeDecl(decl) || ast.isConfigDecl(decl) || ast.isMatrixDecl(decl));
}

function placeholder(infer: Infer): Type {
  return infer.ctx.fresh();
}

function problem(mismatch: TypeMismatch, uri: string): Problem {
  const title = titleOf(mismatch);
  return buildProblem({
    spec: mismatch.unit ? CODES.VN3012_UNIT_MISMATCH : CODES.VN3010_TYPE_MISMATCH,
    span: spanOf(mismatch.node, uri),
    title,
  });
}

/** A unit clash already reads as a sentence; anything else is a type mismatch. */
function titleOf(mismatch: TypeMismatch): string {
  if (mismatch.unit) return mismatch.note ?? "These values cannot be combined.";
  if (mismatch.note) return `Type ${showType(mismatch.expected)} ${mismatch.note}.`;
  return `Type mismatch: expected ${showType(mismatch.expected)}, found ${showType(mismatch.actual)}.`;
}

function spanOf(node: { $cstNode?: unknown }, uri: string): Span {
  const cst = node.$cstNode as
    | { offset: number; length: number; range?: { start: { line: number; character: number } } }
    | undefined;
  const start = cst?.range?.start;
  return {
    uri,
    offset: cst?.offset ?? 0,
    length: cst?.length ?? 0,
    line: (start?.line ?? 0) + 1,
    column: (start?.character ?? 0) + 1,
  };
}
