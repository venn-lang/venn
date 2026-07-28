import type { TypeContext } from "./context.js";
import type { Type } from "./type.types.js";
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

function substitute(type: Type, mapping: ReadonlyMap<number, Type>): Type {
  const t = prune(type);
  switch (t.kind) {
    case "var":
      return mapping.get(t.id) ?? t;
    case "list":
      return { kind: "list", element: substitute(t.element, mapping) };
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

function substituteFields(
  fields: ReadonlyMap<string, Type>,
  mapping: ReadonlyMap<number, Type>,
): Map<string, Type> {
  return new Map([...fields].map(([name, field]) => [name, substitute(field, mapping)]));
}
