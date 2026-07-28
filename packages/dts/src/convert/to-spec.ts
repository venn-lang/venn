import type { TypeSpec } from "@venn-lang/types";
import ts from "tsc-api";
import { fnSpec, recordSpec } from "./shapes.js";

/** How far into a type to look, and how much of one to read at all. */
const DEPTH = 4;
const BUDGET = 20_000;

const DYNAMIC: TypeSpec = { kind: "dynamic" };

/**
 * What one conversion carries: the checker, how deep it is, and what it has
 * already worked out.
 *
 * The shared state is not an optimisation. A real package's types form a graph,
 * not a tree (`zod`'s `z` holds hundreds of members, most of them leading back
 * to the same handful of shapes), so a branch read on its own re-expands the
 * same types until the machine runs out of memory. Reading each type once, and
 * stopping at a budget, is what makes this finish.
 */
export interface Conversion {
  checker: ts.TypeChecker;
  depth: number;
  state: ConversionState;
}

/** What every branch of one conversion shares. */
export interface ConversionState {
  done: Map<ts.Type, TypeSpec>;
  /** Types being read right now, so one that contains itself does not loop. */
  open: Set<ts.Type>;
  /** How many more types may be read before the rest is `dynamic`. */
  left: number;
}

/** A state with nothing read yet and the full budget left. */
export function newState(): ConversionState {
  return { done: new Map(), open: new Set(), left: BUDGET };
}

/**
 * One TypeScript type, as the language's own.
 *
 * Everything TS can say projects onto the ten shapes or degrades to `dynamic`,
 * never to a failure. Generics, conditionals and mapped types are gone by the
 * time anything reaches here: the compiler resolved them, so what arrives is the
 * answer rather than the machinery.
 *
 * @param type a type the checker has already resolved
 * @param conv the checker, the current depth and the state shared across branches
 * @returns the type as a `TypeSpec`, or `dynamic` once the depth, the budget or
 * a cycle stops the reading
 */
export function toSpec(type: ts.Type, conv: Conversion): TypeSpec {
  const known = conv.state.done.get(type);
  if (known) return known;
  if (conv.depth > DEPTH || conv.state.left <= 0 || conv.state.open.has(type)) return DYNAMIC;
  conv.state.left--;
  conv.state.open.add(type);
  const spec = convert(type, conv);
  conv.state.open.delete(type);
  // Only a reading that ran to the end is worth keeping: one cut short by the
  // depth limit says more about where it was met than about the type.
  if (conv.depth < DEPTH) conv.state.done.set(type, spec);
  return spec;
}

function convert(type: ts.Type, conv: Conversion): TypeSpec {
  const flags = type.flags;
  const primitive = primitiveOf(flags);
  if (primitive) return primitive;
  if (flags & ts.TypeFlags.StringLiteral) return literal((type as ts.StringLiteralType).value);
  if (flags & ts.TypeFlags.NumberLiteral) return literal((type as ts.NumberLiteralType).value);
  if (flags & ts.TypeFlags.Union) return unionOf(type as ts.UnionType, deeper(conv));
  return structural(type, deeper(conv));
}

function deeper(conv: Conversion): Conversion {
  return { ...conv, depth: conv.depth + 1 };
}

const PRIMITIVES: [ts.TypeFlags, TypeSpec][] = [
  [ts.TypeFlags.String, { kind: "prim", name: "string" }],
  [ts.TypeFlags.Number, { kind: "prim", name: "number" }],
  [ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral, { kind: "prim", name: "bool" }],
  [ts.TypeFlags.Void | ts.TypeFlags.Undefined, { kind: "prim", name: "void" }],
  [ts.TypeFlags.Null, { kind: "prim", name: "null" }],
  [ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never, DYNAMIC],
];

function primitiveOf(flags: ts.TypeFlags): TypeSpec | undefined {
  for (const [mask, spec] of PRIMITIVES) {
    if (flags & mask) return spec;
  }
  return undefined;
}

function literal(value: string | number): TypeSpec {
  return { kind: "literal", value };
}

/**
 * A union, with the branches TypeScript adds for absence folded away.
 *
 * `string | undefined` is one type in this language, a string that may not be
 * there. Writing it as a two-branch union would make every optional field
 * something the reader has to take apart before using.
 */
function unionOf(type: ts.UnionType, conv: Conversion): TypeSpec {
  const members = type.types
    .filter((one) => !(one.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)))
    .map((one) => toSpec(one, conv));
  if (members.length === 0) return { kind: "prim", name: "null" };
  return members.length === 1 ? (members[0] as TypeSpec) : { kind: "union", members };
}

/** An array, a callable, or an object with properties, in that order. */
function structural(type: ts.Type, conv: Conversion): TypeSpec {
  const element = elementOf(type, conv);
  if (element) return { kind: "list", element };
  const calls = conv.checker.getSignaturesOfType(type, ts.SignatureKind.Call);
  if (calls.length > 0) return fnSpec(calls[0] as ts.Signature, conv);
  return type.getProperties().length > 0 ? recordSpec(type, conv) : DYNAMIC;
}

/**
 * What a list holds, when the type is one.
 *
 * A tuple reads as a list of whatever its slots hold together: the language has
 * no fixed-length list, and `list<string | number>` is nearer the truth than
 * saying nothing at all.
 */
function elementOf(type: ts.Type, conv: Conversion): TypeSpec | undefined {
  const checker = conv.checker;
  if (checker.isArrayType(type)) {
    const [arg] = checker.getTypeArguments(type as ts.TypeReference);
    return arg ? toSpec(arg, conv) : DYNAMIC;
  }
  if (!checker.isTupleType(type)) return undefined;
  const members = checker
    .getTypeArguments(type as ts.TypeReference)
    .map((one) => toSpec(one, conv));
  if (members.length === 0) return DYNAMIC;
  return members.length === 1 ? (members[0] as TypeSpec) : { kind: "union", members };
}
