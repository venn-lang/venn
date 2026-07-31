import type { AstNode } from "langium";
import { dottedPath } from "../ast/index.js";
import { CODES } from "../codes/index.js";
import type {
  Binary,
  Call,
  DecoDecl,
  Expr,
  FnBody,
  Index,
  ListLit,
  MapEntry,
  MapLit,
  Member,
  Param,
  ParamList,
  Pattern,
  StringLit,
  Ternary,
  TypeRef,
  Unary,
} from "../generated/ast.js";
import { scanInterpolations } from "../interpolation/index.js";
import { parseExpression } from "../parse/parse-expression.js";
import { callType } from "./action-signature.js";
import { memberType } from "./builtins.js";
import { callingAValue } from "./calling-a-value.js";
import type { TypeCatalog } from "./catalog.types.js";
import { checkMatch } from "./check-match.js";
import { badPatternIn } from "./check-pattern.js";
import type { TypeContext } from "./context.js";
import { mergedCall } from "./merged-call.js";
import type { NamedTypes } from "./named-types.js";
import { narrowed } from "./narrow.js";
import { patternTypes } from "./pattern-types.js";
import { emptyPour, pour, shapeOf } from "./poured-into.js";
import { instantiate, mono } from "./scheme.js";
import type { ParamSeeds } from "./seed-params.js";
import type { ValueSeeds } from "./seed-values.js";
import { showType } from "./show.js";
import {
  BOOL,
  DYNAMIC,
  fn,
  list,
  NULL,
  NUMBER,
  STRING,
  type Type,
  type UnionType,
  union,
} from "./type.types.js";
import { type TypeEnv, withAll } from "./type-env.js";
import { typeRefToType } from "./type-ref.js";
import { fieldType, prune, unify } from "./unify.js";
import { combinedType, literalType } from "./unit-types.js";

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
  imports?: ReadonlyMap<string, Type>;
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
    case "Ternary":
      return inferTernary(expr, env, infer);
    case "ListLit":
      return inferList(expr, env, infer);
    case "MapLit":
      return inferMap(expr, env, infer);
    case "FnExpr":
      return inferFn({ params: expr.params, body: expr.body, returns: expr.returns }, env, infer);
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
  const slots = scanInterpolations(text).map((slot) => slotExpr(slot.source));
  infer.parsed?.set(expr, slots);
  return slots;
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

/** Infer without accusing: a repaired expression is a guess, not what was written. */
function quiet(infer: Infer): Infer {
  return { ...infer, ctx: { ...infer.ctx, mismatches: [] } };
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
  const built = memberType(receiver, expr.member, infer.ctx);
  if (built) return built;
  if (receiver.kind === "record") return recordField(receiver, expr, infer);
  if (receiver.kind === "union") return unionField(receiver, expr, infer);
  return unknownMember(receiver, expr, infer);
}

/** `math.pi`, when a plugin published it and nothing local shadows the name. */
function publishedValue(expr: Member, env: TypeEnv, infer: Infer): Type | undefined {
  const path = dottedPath(expr);
  if (!path || !infer.catalog?.valueOf) return undefined;
  const head = path.slice(0, path.indexOf("."));
  return env.lookup(head) ? undefined : infer.catalog.valueOf(path);
}

/**
 * A field on a union: every branch's answer, as one type.
 *
 * A field only some shapes carry is the whole reason narrowing exists, so it is
 * reported rather than answered with `dynamic`: inside `if r.kind == "ok"` the
 * value is one shape, and the field is there. Only shapes, though. A
 * `string | number` is a value two things could be rather than a decision
 * somebody has to make, and reading it has always been the run's business.
 */
function unionField(receiver: UnionType, expr: Member, infer: Infer): Type {
  const found = receiver.members.map((member) => branchField(member, expr.member));
  if (found.every((type) => type !== undefined)) return union(found as Type[]);
  if (asking(expr) || !receiver.members.every(isShape)) return DYNAMIC;
  infer.ctx.mismatches.push({
    node: expr,
    expected: receiver,
    actual: DYNAMIC,
    note: `does not carry "${expr.member}" on every branch`,
  });
  return DYNAMIC;
}

/** A branch whose fields are all known, which is what makes a missing one wrong. */
function isShape(member: Type): boolean {
  return prune(member).kind === "record";
}

/** What one branch of a union answers for a field, or nothing when it has none. */
function branchField(member: Type, name: string): Type | undefined {
  const t = prune(member);
  if (t.kind === "dynamic" || t.kind === "var") return DYNAMIC;
  return t.kind === "record" ? fieldType(t, name) : undefined;
}

/**
 * Whether a member the shape does not carry is a mistake.
 *
 * `?.` asks whether something is there, so "no" is an answer rather than an
 * error. Reporting one made the operator useless exactly where the shape is
 * known, which is the only place it could have helped. Plain `.` still says the
 * member is there, and is still wrong when it is not.
 */
function asking(expr: Member): boolean {
  return expr.optional === true;
}

/**
 * The kinds whose members are all known: a string, a list, a handle, a literal.
 *
 * There is no shape one of these could turn out to have later, so answering
 * `dynamic` for a member it does not carry is not caution but a wrong answer.
 * Anything still open, `dynamic` above all, is left alone.
 */
const CLOSED_MEMBERS = new Set(["list", "prim", "opaque", "literal"]);

function unknownMember(receiver: Type, expr: Member, infer: Infer): Type {
  if (!CLOSED_MEMBERS.has(receiver.kind)) return DYNAMIC;
  if (asking(expr)) return DYNAMIC;
  infer.ctx.mismatches.push({
    node: expr,
    expected: receiver,
    actual: DYNAMIC,
    note: `has no member "${expr.member}"`,
  });
  return DYNAMIC;
}

function recordField(
  receiver: Extract<Type, { kind: "record" }>,
  expr: Member,
  infer: Infer,
): Type {
  const found = fieldType(receiver, expr.member);
  if (found) return found;
  if (asking(expr)) return DYNAMIC;
  infer.ctx.mismatches.push({
    node: expr,
    expected: receiver,
    actual: DYNAMIC,
    note: `has no field "${expr.member}"`,
  });
  return DYNAMIC;
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
  const args = (expr.args?.args ?? []).map((arg) => inferExpr(arg.value, env, infer));
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
  expect(infer, expr, callee, fn(args, result));
  return result;
}

/** What a plugin verb gives back, when the callee names one. */
function verbCall(expr: Call, env: TypeEnv, infer: Infer): Type | undefined {
  const target = dottedPath(expr.callee);
  if (!target || !infer.catalog?.signatureOf(target)) return undefined;
  const args = (expr.args?.args ?? []).map((arg) => arg.value);
  return callType({ target, args }, env, infer);
}

function inferIndex(expr: Index, env: TypeEnv, infer: Infer): Type {
  const receiver = prune(inferExpr(expr.receiver, env, infer));
  inferExpr(expr.index, env, infer);
  if (receiver.kind === "list") return receiver.element;
  return DYNAMIC;
}

const ARITHMETIC = new Set(["+", "-", "*", "/", "%"]);
const COMPARISON = new Set(["<", ">", "<=", ">="]);

function inferBinary(expr: Binary, env: TypeEnv, infer: Infer): Type {
  const op = expr.operator;
  const left = inferExpr(expr.left, env, infer);
  const right = inferExpr(expr.right, env, infer);
  if (ARITHMETIC.has(op) || COMPARISON.has(op)) return arithmetic({ infer, expr, op, left, right });
  if (op === "&&" || op === "||") return BOOL;
  if (op === "??") return unify(left, right) ? left : DYNAMIC;
  return BOOL;
}

/**
 * Arithmetic and comparison, unit-aware.
 *
 * When both sides are known (`300ms` and `1s`, or `2mb` and `5`) the unit rule
 * decides, and a mismatch is a compile error rather than something the run finds
 * out later. When either side is still an unsolved variable this falls back to
 * plain numbers, which is what teaches `fn double(x) => x * 2` that `x` is one.
 */
function arithmetic(args: {
  infer: Infer;
  expr: Binary;
  op: string;
  left: Type;
  right: Type;
}): Type {
  const { infer, expr, op, left, right } = args;
  const combined = combinedType(op, prune(left), prune(right));
  if (!combined) return numeric(infer, expr, left, right, COMPARISON.has(op));
  if (combined.ok) return combined.type;
  mismatched(infer, expr, prune(left), prune(right), op);
  return DYNAMIC;
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

/**
 * A list literal. Every item is the same type, and a `...` pours in a list of
 * that same type, which is the only thing it could pour in.
 */
function inferList(expr: ListLit, env: TypeEnv, infer: Infer): Type {
  const element = infer.ctx.fresh() as Type;
  for (const item of expr.items) {
    const type = inferExpr(item.value, env, infer);
    expect(infer, item.value, type, item.spread ? list(element) : element);
  }
  return list(element);
}

/**
 * A map literal, field by field, with a `...` pouring another map's fields in
 * where it is written. Later wins, so a key after a spread is the one that
 * counts, and a spread of something whose shape nobody knows leaves the whole
 * literal unknown: any field could be the one it overwrote.
 */
function inferMap(expr: MapLit, env: TypeEnv, infer: Infer): Type {
  const into = emptyPour();
  for (const entry of expr.entries) {
    const type = inferExpr(entry.value, env, infer);
    if (!entry.spread) {
      into.fields.set(entry.key as string, type);
    } else if (!pour(into, type)) {
      return notAMap(entry, type, infer);
    }
  }
  return shapeOf(into);
}

/** A `...` of something that is not a map, said where it can still be helped. */
function notAMap(entry: MapEntry, type: Type, infer: Infer): Type {
  const held = prune(type);
  if (held.kind === "dynamic" || held.kind === "var") return DYNAMIC;
  infer.ctx.mismatches.push({
    node: entry,
    expected: held,
    actual: DYNAMIC,
    note: "is not a map, so it cannot be poured into one",
  });
  return DYNAMIC;
}

/**
 * What a parameter is: what it was annotated with, what the callers said, or an
 * open question for the body to answer.
 */
function paramType(param: Param, infer: Infer): Type {
  if (param.paramType) {
    const { ctx, named, catalog } = infer;
    return typeRefToType({ ref: param.paramType, ctx, named, catalog });
  }
  return infer.seeds?.get(param) ?? infer.ctx.fresh();
}

/** Infer a function type: params, body, and an inferred (or annotated) result. */
export function inferFn(
  decl: { params?: ParamList; body: FnBody; returns?: TypeRef },
  env: TypeEnv,
  infer: Infer,
): Type {
  const params = (decl.params?.params ?? []).map((param) => ({
    node: param,
    type: paramType(param, infer),
  }));
  let body = env;
  for (const param of params) body = inScope(param, body, infer);
  const result = inferBody(decl.body, body, infer);
  // Record each parameter once the body has constrained it, so hover and
  // completion know what `p` is inside `xs.filter(fn (p) => …)`.
  for (const param of params) infer.types?.set(param.node, param.type);
  return fn(
    params.map((param) => param.type),
    declaredResult(decl, result, infer),
  );
}

/**
 * What callers are handed back: the annotation when there is one.
 *
 * The body is checked against it either way, but a `-> Message` that returns one
 * of the shapes a Message can be must reach its callers as a Message. Handing
 * back what the body happened to build makes the union unwritable: a list of two
 * of them would be a list of two different things.
 */
function declaredResult(
  decl: { returns?: TypeRef; body: FnBody },
  result: Type,
  infer: Infer,
): Type {
  if (!decl.returns) return result;
  const { ctx, named, catalog } = infer;
  const declared = typeRefToType({ ref: decl.returns, ctx, named, catalog });
  expect(infer, decl.body, result, declared);
  return declared;
}

/**
 * A body's locals, then the expression it ends with.
 *
 * That last expression may be missing. A half-written `fn` is the normal state
 * of a file being edited, and it is exactly then that the editor asks what
 * things are, so missing means unknown rather than broken.
 */
function inferBody(body: FnBody, env: TypeEnv, infer: Infer): Type {
  let scope = env;
  for (const local of body.locals) {
    if (!local.value) continue;
    const type = inferExpr(local.value, scope, infer);
    scope = local.name ? scope.with(local.name, mono(type)) : takenApart(local, type, scope, infer);
  }
  return body.result ? inferExpr(body.result, scope, infer) : DYNAMIC;
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

/** Unify `actual` with `expected`, recording a mismatch on the node if it fails. */
export function expect(infer: Infer, node: AstNode, actual: Type, expected: Type): void {
  if (!unify(actual, expected)) report(infer, node, expected, actual);
}

function report(infer: Infer, node: AstNode, expected: Type, actual: Type, _note?: string): void {
  infer.ctx.mismatches.push({ node, expected, actual });
}
