import type { TypeContext } from "./context.js";
import type { ListType, Type } from "./type.types.js";
import { positional } from "./type.types.js";
import { prune } from "./unify.js";

/**
 * A type scheme: a type universally quantified over some variables. This is what
 * makes generics real. `fn id(x) => x` becomes `∀t. t -> t`, and every call
 * instantiates `t` afresh, so `id(1)` and `id("a")` both check.
 */
export interface Scheme {
  readonly quantified: readonly number[];
  readonly type: Type;
}

/** A non-generic scheme: a plain type with nothing quantified. */
export function mono(type: Type): Scheme {
  return { quantified: [], type };
}

/** Collect the ids of the unsolved variables reachable from a type. */
export function freeVars(type: Type, into: Set<number> = new Set()): Set<number> {
  const t = prune(type);
  if (t.kind === "var") into.add(t.id);
  else if (t.kind === "list") freeVars(t.element, into);
  else if (t.kind === "fn") {
    for (const param of t.params) freeVars(param, into);
    freeVars(t.result, into);
  } else if (t.kind === "record") {
    for (const field of t.fields.values()) freeVars(field, into);
  }
  return into;
}

/**
 * Generalise a type over the variables free in it but not in the environment.
 * Those become the scheme's type parameters.
 */
export function generalize(type: Type, envFree: ReadonlySet<number>): Scheme {
  const quantified = [...freeVars(type)].filter((id) => !envFree.has(id));
  return { quantified, type };
}

/** Instantiate a scheme with fresh variables for each quantified parameter. */
export function instantiate(scheme: Scheme, ctx: TypeContext): Type {
  if (scheme.quantified.length === 0) return scheme.type;
  const fresh = new Map(scheme.quantified.map((id) => [id, ctx.fresh() as Type]));
  return substitute(scheme.type, fresh);
}

/**
 * A scheme with its parameters filled by the types written at the use site.
 *
 * `instantiate` fills them with fresh variables, for inference to solve. This
 * fills them with what an annotation said, which is what `Box<string>` means:
 * the parameters are not to be solved, they were given.
 *
 * A parameter nobody gave becomes a fresh variable, so `Box` on its own is
 * `Box<something>` rather than an error about arity.
 *
 * @param scheme The declared generic.
 * @param args What the use site wrote, in order.
 * @param ctx Where a fresh variable comes from, for a parameter left out.
 * @returns The body, with each parameter replaced.
 */
export function applyTo(scheme: Scheme, args: readonly Type[], ctx: TypeContext): Type {
  if (scheme.quantified.length === 0) return scheme.type;
  const filled = new Map(
    scheme.quantified.map((id, at) => [id, args[at] ?? (ctx.fresh() as Type)] as const),
  );
  return substitute(scheme.type, filled);
}

function substitute(type: Type, mapping: ReadonlyMap<number, Type>): Type {
  const t = prune(type);
  switch (t.kind) {
    case "var":
      return mapping.get(t.id) ?? t;
    case "list":
      return substituteList(t, mapping);
    case "fn":
      return {
        kind: "fn",
        params: t.params.map((param) => substitute(param, mapping)),
        result: substitute(t.result, mapping),
      };
    case "record":
      return { kind: "record", open: t.open, fields: substituteFields(t.fields, mapping) };
    default:
      return t;
  }
}

/**
 * A pair keeps its positions, or it silently stops being a pair and every
 * position of it goes back to answering the whole union.
 */
function substituteList(t: ListType, mapping: ReadonlyMap<number, Type>): ListType {
  const element = substitute(t.element, mapping);
  if (!t.positions) return { kind: "list", element };
  return positional(
    element,
    t.positions.map((held) => substitute(held, mapping)),
  );
}

function substituteFields(
  fields: ReadonlyMap<string, Type>,
  mapping: ReadonlyMap<number, Type>,
): Map<string, Type> {
  return new Map([...fields].map(([name, field]) => [name, substitute(field, mapping)]));
}
