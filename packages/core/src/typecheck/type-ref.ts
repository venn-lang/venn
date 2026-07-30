import type { SingleType, TypeBody, TypeRef } from "../generated/ast.js";
import { isNamedType, isNullType, isShapeType } from "../generated/ast.js";
import type { TypeCatalog } from "./catalog.types.js";
import type { TypeContext } from "./context.js";
import type { NamedTypes } from "./named-types.js";
import {
  DYNAMIC,
  fn,
  list,
  literal,
  mapOf,
  NULL,
  prim,
  record,
  type Type,
  union,
} from "./type.types.js";

const PRIMS = new Set(["number", "string", "bool", "null", "void"]);

/** Everything resolving a written annotation may need to look something up. */
export interface RefScope {
  ctx: TypeContext;
  named: NamedTypes;
  /** Where a qualified name like `http.Request` is found. */
  catalog?: TypeCatalog;
}

/**
 * Read a written annotation (`list<number>`, `User`, `http.Request`,
 * `"GET" | "POST"`) into a type. An unknown name stays `dynamic`, so an
 * annotation never adds friction: being wrong about a name must not be worse
 * than saying nothing.
 */
export function typeRefToType(args: RefScope & { ref: TypeRef | undefined }): Type {
  if (!args.ref) return args.ctx.fresh();
  const members = args.ref.members.map((single) => singleToType({ ...args, single }));
  if (members.length === 0) return DYNAMIC;
  return union(members as Type[]);
}

function singleToType(args: RefScope & { single: SingleType }): Type {
  const { single } = args;
  if (isShapeType(single)) return shapeOf({ ...args, body: single.body });
  // The same `T | null` an optional field already builds, said out loud.
  if (isNullType(single)) return NULL;
  // A `SingleType` that is neither a name nor a shape is a written-out literal
  // such as `"GET"`, and it means that one value. Widening it to `string` would
  // enforce nothing.
  if (!isNamedType(single)) return literalOf(single);
  const name = single.name;
  const generic = genericType(name, single, args);
  if (generic) return generic;
  if (PRIMS.has(name)) return prim(name as "number");
  return args.named.get(name) ?? args.catalog?.typeOf(name) ?? DYNAMIC;
}

/**
 * The record a `{ … }` describes, whether it was written after `type User` or
 * inline where it is used.
 *
 * One function for both, so a shape means the same thing wherever it appears: an
 * inline `{ city: string }` and a `type Address { city: string }` build the same
 * record and are interchangeable.
 *
 * @param args The body, and what resolving the fields' own annotations needs.
 * @returns A record type. An optional field reads as `T | null`.
 */
export function shapeOf(args: RefScope & { body: TypeBody | undefined }): Type {
  const fields = new Map<string, Type>();
  for (const field of args.body?.fields ?? []) {
    const type = typeRefToType({ ...args, ref: field.fieldType });
    fields.set(field.name, field.optional ? union([type, NULL]) : type);
  }
  return record(fields);
}

/** `"GET"` written as a type. The quotes are the grammar's, not the value's. */
function literalOf(single: SingleType): Type {
  const written = (single as { value?: string }).value ?? "";
  return literal(written.replace(/^["']|["']$/g, ""));
}

function genericType(
  name: string,
  single: SingleType & { args?: TypeRef[] },
  args: RefScope,
): Type | undefined {
  // `ref` last, deliberately: the scope threaded down here still carries the
  // *outer* annotation, and spreading it afterwards would hand each argument its
  // own parent, leaving `list<number>` reading itself forever.
  const params = (single.args ?? []).map((ref) => typeRefToType({ ...args, ref }));
  if (name === "list") return list(params[0] ?? DYNAMIC);
  if (name === "fn") return fn(params.slice(0, -1), params[params.length - 1] ?? DYNAMIC);
  // Keys unnamed, values all alike. The value is the last argument, so
  // `map<string, User>` and `map<User>` mean the same thing: a key is a name
  // either way. A bare `map` is the loose map a JSON body arrives as.
  if (name === "map") return mapOf(params[params.length - 1] ?? DYNAMIC);
  return undefined;
}
