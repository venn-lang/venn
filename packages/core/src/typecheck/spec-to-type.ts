import type { FnSpec, RecordSpec, TypeSpec } from "@venn-lang/types";
import {
  DYNAMIC,
  fn,
  list,
  literal,
  mapOf,
  NULL,
  opaque,
  prim,
  record,
  type Type,
  union,
  variadic,
} from "./type.types.js";

/** How a `ref` finds what it points at. Returning undefined is fine: the
 * reference degrades to `dynamic` rather than failing. */
export type ResolveRef = (name: string) => Type | undefined;

/**
 * Where the type parameters of one signature live while it is being read.
 *
 * Two `T`s in a signature are the same type, so the first one seen makes the
 * variable and the rest find it. A fresh table per reading is what makes each
 * *use* of a signature independent: `map` over a `list<string>` must not decide
 * what `T` is for every other call in the file.
 */
export type ParamScope = Map<string, Type>;

/**
 * Read the published form of a type into the checker's own.
 *
 * The wire format is plain data with no inference variables; the checker's type
 * is a live thing that unification writes into. Keeping them apart is what lets
 * a signature be written by hand, generated from a `.d.ts`, or shipped as JSON
 * without any of them reaching into the compiler.
 */
export function specToType(spec: TypeSpec, resolve: ResolveRef, params?: ParamScope): Type {
  switch (spec.kind) {
    case "param":
      // Without a scope there is nothing to be polymorphic in: a published type
      // carrying a parameter is one nobody can name, so it reads as `dynamic`.
      return params ? paramType(spec.name, params) : DYNAMIC;
    case "prim":
      return prim(spec.name);
    case "literal":
      return literal(spec.value);
    case "list":
      return list(specToType(spec.element, resolve, params));
    case "map":
      return mapOf(specToType(spec.value, resolve, params));
    default:
      return compound(spec, resolve, params);
  }
}

/** The variable this name stands for, made once per reading. */
function paramType(name: string, params: ParamScope): Type {
  const known = params.get(name);
  if (known) return known;
  const made: Type = { kind: "var", id: -params.size - 1, ref: undefined };
  params.set(name, made);
  return made;
}

function compound(spec: TypeSpec, resolve: ResolveRef, params?: ParamScope): Type {
  switch (spec.kind) {
    case "record":
      return recordType(spec, resolve, params);
    case "fn":
      return fnType(spec, resolve, params);
    case "union":
      return union(spec.members.map((member) => specToType(member, resolve, params)));
    case "opaque":
      return opaque(spec.name, opaqueMembers(spec.members, resolve, params));
    case "ref":
      return resolve(spec.name) ?? DYNAMIC;
    default:
      return DYNAMIC;
  }
}

/** An optional field is one that may not be there: `T | null`, said plainly. */
function recordType(spec: RecordSpec, resolve: ResolveRef, params?: ParamScope): Type {
  const optional = new Set(spec.optional ?? []);
  const fields = new Map<string, Type>();
  for (const [name, field] of Object.entries(spec.fields)) {
    const type = specToType(field, resolve, params);
    fields.set(name, optional.has(name) ? union([type, NULL]) : type);
  }
  return record(fields, spec.open ?? false);
}

/** What a handle publishes, read into the checker's own types. */
function opaqueMembers(
  members: Readonly<Record<string, TypeSpec>> | undefined,
  resolve: ResolveRef,
  params?: ParamScope,
): ReadonlyMap<string, Type> | undefined {
  if (!members) return undefined;
  const into = new Map<string, Type>();
  for (const [name, spec] of Object.entries(members)) {
    into.set(name, specToType(spec, resolve, params));
  }
  return into;
}

function fnType(spec: FnSpec, resolve: ResolveRef, scope?: ParamScope): Type {
  const params = spec.params.map((param) => specToType(param, resolve, scope));
  const result = specToType(spec.result, resolve, scope);
  if (spec.variadic) return variadic(params, result);
  return spec.takes === undefined
    ? fn(params, result)
    : { kind: "fn", params, result, ignorableFrom: spec.takes };
}
