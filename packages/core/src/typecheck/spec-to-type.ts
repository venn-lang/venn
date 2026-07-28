import type { FnSpec, RecordSpec, TypeSpec } from "@venn/types";
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
} from "./type.types.js";

/** How a `ref` finds what it points at. Returning undefined is fine: the
 * reference degrades to `dynamic` rather than failing. */
export type ResolveRef = (name: string) => Type | undefined;

/**
 * Read the published form of a type into the checker's own.
 *
 * The wire format is plain data with no inference variables; the checker's type
 * is a live thing that unification writes into. Keeping them apart is what lets
 * a signature be written by hand, generated from a `.d.ts`, or shipped as JSON
 * without any of them reaching into the compiler.
 */
export function specToType(spec: TypeSpec, resolve: ResolveRef): Type {
  switch (spec.kind) {
    case "prim":
      return prim(spec.name);
    case "literal":
      return literal(spec.value);
    case "list":
      return list(specToType(spec.element, resolve));
    case "map":
      return mapOf(specToType(spec.value, resolve));
    default:
      return compound(spec, resolve);
  }
}

function compound(spec: TypeSpec, resolve: ResolveRef): Type {
  switch (spec.kind) {
    case "record":
      return recordType(spec, resolve);
    case "fn":
      return fnType(spec, resolve);
    case "union":
      return union(spec.members.map((member) => specToType(member, resolve)));
    case "opaque":
      return opaque(spec.name, opaqueMembers(spec.members, resolve));
    case "ref":
      return resolve(spec.name) ?? DYNAMIC;
    default:
      return DYNAMIC;
  }
}

/** An optional field is one that may not be there: `T | null`, said plainly. */
function recordType(spec: RecordSpec, resolve: ResolveRef): Type {
  const optional = new Set(spec.optional ?? []);
  const fields = new Map<string, Type>();
  for (const [name, field] of Object.entries(spec.fields)) {
    const type = specToType(field, resolve);
    fields.set(name, optional.has(name) ? union([type, NULL]) : type);
  }
  return record(fields, spec.open ?? false);
}

/** What a handle publishes, read into the checker's own types. */
function opaqueMembers(
  members: Readonly<Record<string, TypeSpec>> | undefined,
  resolve: ResolveRef,
): ReadonlyMap<string, Type> | undefined {
  if (!members) return undefined;
  const into = new Map<string, Type>();
  for (const [name, spec] of Object.entries(members)) into.set(name, specToType(spec, resolve));
  return into;
}

function fnType(spec: FnSpec, resolve: ResolveRef): Type {
  const params = spec.params.map((param) => specToType(param, resolve));
  const result = specToType(spec.result, resolve);
  return spec.takes === undefined
    ? fn(params, result)
    : { kind: "fn", params, result, ignorableFrom: spec.takes };
}
