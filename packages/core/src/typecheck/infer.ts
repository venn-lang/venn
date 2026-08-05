import type { AstNode } from "langium";
import { dottedPath } from "../ast/index.js";
import { CODES } from "../codes/index.js";
import type * as ast from "../generated/ast.js";
import type {
  Binary,
  Call,
  DecoDecl,
  Expr,
  FnBody,
  FragmentDecl,
  Index,
  Member,
  Param,
  ParamList,
  Pattern,
  StringLit,
  Ternary,
  TypeRef,
  Unary,
} from "../generated/ast.js";
import type { InterpolationSlot } from "../interpolation/index.js";
import { scanInterpolations } from "../interpolation/index.js";
import { parseExpression } from "../parse/parse-expression.js";
import { markSlotIn } from "../span/index.js";
import { positionKey } from "../value/index.js";
import { callType } from "./action-signature.js";
import { positionType } from "./at-a-position.js";
import { argumentsFit } from "./call-arguments.js";
import { callingAValue } from "./calling-a-value.js";
import type { TypeCatalog } from "./catalog.types.js";
import { checkMatch } from "./check-match.js";
import { badPatternIn } from "./check-pattern.js";
import { checkStatement } from "./check-stmts.js";
import { inferAgainst, inferList, inferMap } from "./checked-against.js";
import type { TypeContext } from "./context.js";
import { ERROR_TYPE } from "./error-type.js";
import { fits } from "./fits.js";
import { identityComparison } from "./identity-comparison.js";
import type { ImportedType } from "./imported-types.js";
import { lambdaParams } from "./lambda-params.js";
import { either, logicalType } from "./logical-type.js";
import { memberRead } from "./member-read.js";
import { mergedCall } from "./merged-call.js";
import type { NamedTypes } from "./named-types.js";
import { narrowed } from "./narrow.js";
import { patternTypes } from "./pattern-types.js";
import type { ReturnSink } from "./return-sink.types.js";
import { instantiate, mono } from "./scheme.js";
import type { ParamSeeds } from "./seed-params.js";
import type { ValueSeeds } from "./seed-values.js";
import { showType } from "./show.js";
import { insideAJoin, joinedWithPlus, joinsStrings } from "./string-plus.js";
import { BOOL, DYNAMIC, fn, NULL, NUMBER, STRING, type Type } from "./type.types.js";
import { type TypeEnv, withAll } from "./type-env.js";
import { typeRefToType } from "./type-ref.js";
import { prune, unify } from "./unify.js";
import { combinedType, literalType } from "./unit-types.js";
import { isWritten } from "./written-into.js";

/** One `${…}`: what it parsed to, and whether the source had to be repaired. */
export interface Slot {
  expr: Expr | undefined;
  guess: boolean;
}

/** Everything inference threads through: fresh vars, diagnostics, named types. */
export interface Infer {
  ctx: TypeContext;
  named: NamedTypes;
  /** What the loaded plugins contribute. Absent means "the file stands alone". */
  catalog?: TypeCatalog;
  /** What the callers said a named `fn` takes, found by the first pass. */
  seeds?: ParamSeeds;
  /** What the file's own top-level values hold, so a `fn` body can read them. */
  values?: ValueSeeds;
  /** The types of the names this file imported, from the files it named. */
  imports?: ReadonlyMap<string, ImportedType>;
  /** True during that first pass: keep functions monomorphic so calls reach them. */
  seeding?: boolean;
  /** Every expression's inferred type, for hover. Omit it to save the work. */
  types?: Map<AstNode, Type>;
  /** Per string literal, the expression parsed from each of its ${…} slots. */
  slots?: Map<AstNode, (Expr | undefined)[]>;
  /** Shared across the checker's passes, so a `${…}` is parsed once per document. */
  parsed?: Map<AstNode, Slot[]>;
  /** The `deco`s reachable here, local and imported, by the name an `@` writes. */
  decos?: ReadonlyMap<string, DecoDecl>;
  /** The fragments this file declares, so a `run` can be checked against one. */
  fragments?: ReadonlyMap<string, FragmentDecl>;
  /** Where the `return`s of the body being walked report what they hand back. */
  returns?: ReturnSink;
  /**
   * What the innermost `loop` carries, so a `continue` can be checked against
   * it. Absent where the enclosing loop holds no state, which is also what a
   * `continue` with a value has to be told about.
   */
  carried?: Type;
}

/** Infer an expression's type, recording it for hover and reporting mismatches. */
export function inferExpr(expr: Expr, env: TypeEnv, infer: Infer): Type {
  const type = inferKind(expr, env, infer);
  infer.types?.set(expr, type);
  return type;
}

function inferKind(expr: Expr, env: TypeEnv, infer: Infer): Type {
  switch (expr.$type) {
    case "NumberLit":
      return literalType(expr.raw);
    case "StringLit":
      return inferString(expr, env, infer);
    case "BoolLit":
      return BOOL;
    case "NullLit":
      return NULL;
    case "InstantLit":
      return { kind: "prim", name: "instant" };
    case "Ref":
      return inferRef(expr.name, env, infer);
    case "Member":
      return inferMember(expr, env, infer);
    case "Call":
      return inferCall(expr, env, infer);
    case "Index":
      return inferIndex(expr, env, infer);
    case "Binary":
      return inferBinary(expr, env, infer);
    case "Unary":
      return inferUnary(expr, env, infer);
    case "TryExpr":
      return inferTry(expr as ast.TryExpr, env, infer);
    case "Ternary":
      return inferTernary(expr, env, infer);
    case "ListLit":
      return inferList({ expr, env, infer });
    case "MapLit":
      return inferMap({ expr, env, infer });
    case "FnExpr":
      return inferFn({ decl: expr, env, infer });
    case "MatchExpr":
      return checkMatch({ expr, env, infer, wantsValue: true });
    default:
      return DYNAMIC;
  }
}

/** A name the checker does not know types as `dynamic`; it never resolves names. */
function inferRef(name: string, env: TypeEnv, infer: Infer): Type {
  const scheme = env.lookup(name);
  return scheme ? instantiate(scheme, infer.ctx) : DYNAMIC;
}

/**
 * A string is text, but each `${…}` inside it is code. It is parsed apart from
 * the document, so the parsed expressions are kept: they are the only handle the
 * editor has on nodes that inference typed but the document's tree lacks.
 */
function inferString(expr: StringLit, env: TypeEnv, infer: Infer): Type {
  const slots = parsedSlots(expr, infer);
  for (const slot of slots) {
    if (slot.expr) inferExpr(contain(slot.expr, expr), env, slot.guess ? quiet(infer) : infer);
  }
  if (slots.length > 0)
    infer.slots?.set(
      expr,
      slots.map((slot) => slot.expr),
    );
  return STRING;
}

/**
 * The expressions inside one string, parsed once per document.
 *
 * Parsing a `${…}` means running the parser again, and a file may hold hundreds
 * of them; inference walks the document more than once, and the editor walks it
 * on every keystroke. Keyed by the string's own node, so two strings that happen
 * to read alike never share: the parsed expression is told which string contains
 * it, and a shared one would point at the wrong place.
 */
function parsedSlots(expr: StringLit, infer: Infer): Slot[] {
  const known = infer.parsed?.get(expr);
  if (known) return known;
  const text = expr.$cstNode?.text ?? expr.value;
  const slots = scanInterpolations(text).map((slot) => placed(slotExpr(slot.source), slot, expr));
  infer.parsed?.set(expr, slots);
  return slots;
}

/**
 * Tell the parsed expression where it was written.
 *
 * Without this its nodes carry the offsets of the little document the slot was
 * parsed in, and every problem raised over one landed at that document's
 * position rather than at the placeholder's: line 1, column 30, whatever the
 * file said.
 */
function placed(slot: Slot, at: InterpolationSlot, host: StringLit): Slot {
  if (slot.expr) markSlotIn({ expr: slot.expr, host, start: at.sourceStart });
  return slot;
}

/** A dot with no name after it yet: what half-typed member access looks like. */
const UNFINISHED = /\.(?![A-Za-z_])/g;

/**
 * The expression a placeholder holds.
 *
 * Half-typed code such as `xs.map(fn (p) => p.` does not parse, and that is
 * precisely when the editor is asked what `p` is. So one repair is attempted:
 * drop the member access still being written.
 */
function slotExpr(source: string): Slot {
  const whole = parseExpression(source);
  if (whole) return { expr: whole, guess: false };
  // A space, not nothing: every other character keeps the offset the editor
  // will look it up by.
  const repaired = source.replace(UNFINISHED, " ");
  return { expr: repaired === source ? undefined : parseExpression(repaired), guess: true };
}

/**
 * Infer without accusing: a repaired expression is a guess, not what was
 * written.
 *
 * Both sinks are emptied, not only the mismatches. A type name in a guessed
 * slot is as much a guess as a clash in one, and refusing a name the reader
 * never wrote is exactly the accusation this exists to avoid.
 */
function quiet(infer: Infer): Infer {
  return { ...infer, ctx: { ...infer.ctx, mismatches: [], unknownTypes: [] } };
}

/**
 * Say in the tree what the source already says: the expression is written
 * inside the string. With a container, looking a name up from inside `${…}`
 * walks out into the scope the string sits in.
 */
function contain(child: Expr, parent: StringLit): Expr {
  Object.defineProperty(child, "$container", { value: parent, configurable: true });
  return child;
}

function inferMember(expr: Member, env: TypeEnv, infer: Infer): Type {
  // A constant a namespace publishes is read by its whole name, before the
  // receiver is asked about: `math` is a bag of names, not a value with fields.
  const published = publishedValue(expr, env, infer);
  if (published) return published;
  const receiver = prune(inferExpr(expr.receiver, env, infer));
  if (receiver.kind === "dynamic") return DYNAMIC;
  const read = { node: expr, name: expr.member, asking: expr.optional === true };
  return memberRead(receiver, read, infer);
}

/** `math.pi`, when a plugin published it and nothing local shadows the name. */
function publishedValue(expr: Member, env: TypeEnv, infer: Infer): Type | undefined {
  const path = dottedPath(expr);
  if (!path || !infer.catalog?.valueOf) return undefined;
  const head = path.slice(0, path.indexOf("."));
  return env.lookup(head) ? undefined : infer.catalog.valueOf(path);
}

/**
 * A call, whichever of the two the language spells.
 *
 * `http.get("url")` and `http.get "url"` are the same call and carry the same
 * type. The bracketed form is tried as a verb first, since reading it as an
 * ordinary call on whatever `http.get` evaluates to would answer `dynamic` for
 * every verb written in the form most people reach for.
 */
function inferCall(expr: Call, env: TypeEnv, infer: Infer): Type {
  const badPattern = badPatternIn(expr);
  if (badPattern) {
    infer.ctx.mismatches.push({
      node: expr,
      expected: DYNAMIC,
      actual: DYNAMIC,
      sentence: badPattern,
    });
  }
  const verb = verbCall(expr, env, infer);
  if (verb) return verb;
  const callee = prune(inferExpr(expr.callee, env, infer));
  const args = inferArgs({ expr, callee, env, infer });
  if (callee.kind === "dynamic") return DYNAMIC;
  // Worked out from what it was handed, which no signature could have said.
  const merged = mergedCall({ expr, args, infer });
  if (merged) return merged;
  const result = infer.ctx.fresh();
  const sentence = callingAValue({ expr, callee });
  if (sentence) {
    infer.ctx.mismatches.push({ node: expr, expected: callee, actual: DYNAMIC, sentence });
    return DYNAMIC;
  }
  // The whole signature only where an argument is not the problem, since two
  // signatures side by side say less than the one argument that does not fit.
  if (argumentsFit({ expr, callee, given: args, infer })) {
    expect(infer, expr, callee, fn(args, result));
  } else {
    unify(callee, fn(args, result));
  }
  return result;
}

/**
 * Every argument, each told what the callee asks for in its place.
 *
 * A literal is written to be one thing in particular, and the parameter is where
 * the call says which: without it a list of records written at a call site is
 * checked against its own first row rather than against what it is being handed
 * to.
 */
function inferArgs(args: { expr: Call; callee: Type; env: TypeEnv; infer: Infer }): Type[] {
  const { expr, callee, env, infer } = args;
  return (expr.args?.args ?? []).map((arg, at) =>
    inferAgainst({ expr: arg.value, env, infer, wanted: paramAt(callee, at) }),
  );
}

/** What a callee says the argument in one position is, when it says anything. */
function paramAt(callee: Type, at: number): Type | undefined {
  return callee.kind === "fn" ? callee.params[at] : undefined;
}

/**
 * `try expr else fallback`: either the attempt or the fallback, so the type is
 * both.
 *
 * Neither side is asked to agree with the other. A fallback is what stands in
 * when the attempt did not happen, and requiring it to be the same type would
 * refuse `try json.parse(t) else null`, which is the everyday one.
 */
function inferTry(expr: ast.TryExpr, env: TypeEnv, infer: Infer): Type {
  const attempted = inferExpr(expr.attempt, env, infer);
  // What `catch` binds is a failure, whose shape the prelude settles.
  const inner = expr.error ? env.with(expr.error, mono(ERROR_TYPE)) : env;
  const instead = inferExpr(expr.fallback, inner, infer);
  // A fallback that reads the failure has no type until the failure does, and
  // an expression half of which is unknown is unknown.
  if (attempted.kind === "dynamic" || instead.kind === "dynamic") return DYNAMIC;
  return either(attempted, instead);
}

/** What a plugin verb gives back, when the callee names one. */
function verbCall(expr: Call, env: TypeEnv, infer: Infer): Type | undefined {
  const target = dottedPath(expr.callee);
  if (!target || !infer.catalog?.signatureOf(target)) return undefined;
  const args = (expr.args?.args ?? []).map((arg) => arg.value);
  return callType({ target, args }, env, infer);
}

/**
 * `xs[0]` and `m["name"]`.
 *
 * A position is read as one wherever the receiver holds positions, so `xs[0]`
 * and `xs["0"]` are the same element and have the same type, and `s[0]` is the
 * character it reads at run time rather than a member nobody declared.
 *
 * Everything else the source spelled out is the member read written with
 * brackets, and is typed as one. That used to be true of a record and not of a
 * list, which left the wrong promise standing over one spelling:
 * `const s: string = names["len"]` was accepted for a value that is the number
 * 2, while `const n: number = names["len"]` was refused.
 *
 * A key the run works out (`m[k]`, `stats[stat]`) is nobody's mistake and stays
 * `dynamic`: that is what reading a map by a computed key means.
 */
function inferIndex(expr: Index, env: TypeEnv, infer: Infer): Type {
  const receiver = prune(inferExpr(expr.receiver, env, infer));
  inferExpr(expr.index, env, infer);
  const name = writtenKey(expr.index);
  const spot = name === undefined || positionKey(name) !== undefined;
  const held = spot ? positionType(receiver, isWritten(expr)) : undefined;
  if (held) return held;
  if (name === undefined) return DYNAMIC;
  return memberRead(receiver, { node: expr, name, asking: false }, infer);
}

/** The key when the source spelled it out, as against one the run works out. */
function writtenKey(index: Expr): string | undefined {
  if (index.$type !== "StringLit") return undefined;
  // A `${…}` inside makes the key a run-time value, and nothing here to be
  // right or wrong about yet.
  return scanInterpolations(index.value).length > 0 ? undefined : index.value;
}

const ARITHMETIC = new Set(["+", "-", "*", "/", "%"]);
const COMPARISON = new Set(["<", ">", "<=", ">="]);

function inferBinary(expr: Binary, env: TypeEnv, infer: Infer): Type {
  const op = expr.operator;
  const left = inferExpr(expr.left, env, infer);
  const right = inferExpr(expr.right, env, infer);
  if (ARITHMETIC.has(op) || COMPARISON.has(op)) return arithmetic({ infer, expr, op, left, right });
  if (op === "&&" || op === "||" || op === "??") return logicalType(op, left, right);
  const identity = identityComparison({ node: expr, op, left, right });
  if (identity) infer.ctx.mismatches.push(identity);
  return BOOL;
}

/**
 * Arithmetic and comparison, unit-aware.
 *
 * When both sides are known (`300ms` and `1s`, or `2mb` and `5`) the unit rule
 * decides, and a mismatch is a compile error rather than something the run finds
 * out later. When either side is still an unsolved variable this falls back to
 * plain numbers, which is what teaches `fn double(x) => x * 2` that `x` is one.
 *
 * A `+` with a string of either side never gets that far: it is a reach for
 * concatenation, and the unit rule has nothing to say about it.
 */
function arithmetic(args: {
  infer: Infer;
  expr: Binary;
  op: string;
  left: Type;
  right: Type;
}): Type {
  const { infer, expr, op, left, right } = args;
  if (joinsStrings(op, left, right)) return joined(infer, expr);
  const combined = combinedType(op, prune(left), prune(right));
  if (!combined) return numeric(infer, expr, left, right, COMPARISON.has(op));
  if (combined.ok) return combined.type;
  mismatched(infer, expr, prune(left), prune(right), op);
  return DYNAMIC;
}

/**
 * A string, because that is what was meant, so the binding it goes into is not
 * told a second and contradictory thing about the same line.
 */
function joined(infer: Infer, expr: Binary): Type {
  if (!insideAJoin(expr)) infer.ctx.mismatches.push(joinedWithPlus(expr));
  return STRING;
}

function mismatched(infer: Infer, node: AstNode, left: Type, right: Type, op: string): void {
  infer.ctx.mismatches.push({
    node,
    expected: left,
    actual: right,
    code: CODES.VN3012_UNIT_MISMATCH,
    // The sentence the evaluator raises, so a mismatch reads the same whether
    // the checker or the run finds it.
    sentence: `Cannot combine ${showType(left)} with ${showType(right)} using "${op}".`,
  });
}

function numeric(infer: Infer, node: AstNode, left: Type, right: Type, compare = false): Type {
  expect(infer, node, left, NUMBER);
  expect(infer, node, right, NUMBER);
  return compare ? BOOL : NUMBER;
}

function inferUnary(expr: Unary, env: TypeEnv, infer: Infer): Type {
  const operand = inferExpr(expr.operand, env, infer);
  if (expr.operator === "!") return BOOL;
  expect(infer, expr, operand, NUMBER);
  return NUMBER;
}

/**
 * A ternary narrows the way an `if` does, and has to: a `fn` body is one
 * expression, so this is where a pure function tells a union's branches apart.
 */
function inferTernary(expr: Ternary, env: TypeEnv, infer: Infer): Type {
  inferExpr(expr.condition, env, infer);
  const branch = narrowed(expr.condition, env, infer);
  const then = inferExpr(expr.then, branch.whenTrue, infer);
  const otherwise = inferExpr(expr.otherwise, branch.whenFalse, infer);
  return unify(then, otherwise) ? then : DYNAMIC;
}

/** Infer a function type: params, body, and an inferred (or annotated) result. */
export function inferFn(args: {
  decl: { params?: ParamList; body: FnBody; returns?: TypeRef };
  env: TypeEnv;
  infer: Infer;
  /**
   * What the place it was written asks it to be, when there is such a place.
   * `xs.map(x => …)` is where `x` learns it is a number, and it has to learn it
   * before the body is walked rather than from the unification afterwards.
   */
  wanted?: Type;
}): Type {
  const { decl, infer } = args;
  const nodes = decl.params?.params ?? [];
  const params = lambdaParams({ nodes, infer, wanted: args.wanted });
  let scope = args.env;
  for (const param of params) scope = inScope(param, scope, infer);
  const declared = declaredType(decl.returns, infer);
  const result = inferBody({ body: decl.body, env: scope, infer, wanted: declared });
  // Record each parameter once the body has constrained it, so hover and
  // completion know what `p` is inside `xs.filter(fn (p) => …)`.
  for (const param of params) infer.types?.set(param.node, param.type);
  return fn(
    params.map((param) => param.type),
    declaredResult({ body: decl.body, declared, result, infer }),
  );
}

/** What the `->` of a declaration names, when the declaration has one. */
function declaredType(returns: TypeRef | undefined, infer: Infer): Type | undefined {
  if (!returns) return undefined;
  const { ctx, named, catalog } = infer;
  return typeRefToType({ ref: returns, ctx, named, catalog });
}

/**
 * What callers are handed back: the annotation when there is one.
 *
 * The body is checked against it either way, but a `-> Message` that returns one
 * of the shapes a Message can be must reach its callers as a Message. Handing
 * back what the body happened to build makes the union unwritable: a list of two
 * of them would be a list of two different things.
 */
function declaredResult(args: {
  body: FnBody;
  declared: Type | undefined;
  result: Type;
  infer: Infer;
}): Type {
  const { body, declared, result, infer } = args;
  if (!declared) return result;
  expect(infer, body, result, declared);
  return declared;
}

/**
 * A body's statements, then the expression it ends with.
 *
 * What the `fn` declared it hands back is threaded down rather than checked
 * afterwards, since a list literal settles what its items are before anything
 * else reads it: `-> list<Row>` only reaches it on the way in. Each `return`
 * reports into the sink from the scope it stands in, which is the only scope
 * that knows what the `if` around it narrowed.
 *
 * The ending expression may be missing, in two ways that look alike and are not:
 * a half-written `fn` is the normal state of a file being edited, and a body
 * that ends in `return` is finished. Both read as unknown here.
 */
function inferBody(args: { body: FnBody; env: TypeEnv; infer: Infer; wanted?: Type }): Type {
  const { body, infer, wanted } = args;
  const sink: ReturnSink = { wanted, found: [] };
  const inner: Infer = { ...infer, returns: sink };
  let scope = args.env;
  for (const stmt of body.stmts) scope = checkStatement(stmt, scope, inner);
  const ending = body.result
    ? inferAgainst({ expr: body.result, env: scope, infer: inner, wanted })
    : undefined;
  return waysOut(ending, sink.found);
}

/**
 * Every way out of a body, as one type.
 *
 * They are not asked to agree with each other, any more than the two sides of a
 * `try` are. Answering with a value or with nothing is what a lookup does, and a
 * block with two `return`s is how anybody writes one; measuring the second
 * against the type of the first refused that outright. So they make a union, and
 * {@link either} keeps ways out that do agree as the one type they are rather
 * than a union of a thing with itself.
 *
 * An annotation still decides. {@link declaredResult} checks this against it,
 * and `fits` lets a union through only when every member of it is allowed, so
 * `-> string` still refuses the body that may hand back nothing.
 */
function waysOut(ending: Type | undefined, found: readonly Type[]): Type {
  const first = found[0];
  const left = first && found.slice(1).reduce((one, next) => either(one, next), first);
  if (!ending) return left ?? DYNAMIC;
  return left ? either(ending, left) : ending;
}

/** A parameter in the body's scope: under its name, or taken apart. */
function inScope(param: { node: Param; type: Type }, env: TypeEnv, infer: Infer): TypeEnv {
  const { node, type } = param;
  return node.name ? env.with(node.name, mono(type)) : takenApart(node, type, env, infer);
}

/** Every name a pattern binds, in scope, with what the value says each holds. */
function takenApart(node: { pattern?: Pattern }, type: Type, env: TypeEnv, infer: Infer): TypeEnv {
  if (!node.pattern) return env;
  const bound = patternTypes({ pattern: node.pattern, type, infer });
  return withAll(
    env,
    bound.map(([name, held]) => [name, mono(held)] as const),
  );
}

/**
 * Unify `actual` with `expected`, recording a mismatch on the node if it fails.
 *
 * Two questions, because they are two questions. `unify` solves the variables
 * and answers whether the types can be made equal; `fits` answers whether every
 * value the first describes is one the second allows, which is what assignment
 * asks and what a union answers differently in each direction.
 */
export function expect(infer: Infer, node: AstNode, actual: Type, expected: Type): void {
  if (!unify(actual, expected) || !fits(actual, expected)) {
    report(infer, node, expected, actual);
  }
}

function report(infer: Infer, node: AstNode, expected: Type, actual: Type, _note?: string): void {
  infer.ctx.mismatches.push({ node, expected, actual });
}
