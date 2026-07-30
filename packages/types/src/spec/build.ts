import type {
  DynamicSpec,
  FnSpec,
  ListSpec,
  LiteralSpec,
  MapSpec,
  OpaqueSpec,
  ParamSpec,
  PrimSpec,
  RecordSpec,
  RefSpec,
  TypeSpec,
  UnionSpec,
} from "./type-spec.types.js";

/** What a record needs beyond its fields: which are absent, and whether extras pass. */
export interface RecordOptions {
  optional?: readonly string[];
  open?: boolean;
}

/** The authoring surface for a {@link TypeSpec}. */
export interface TypeBuilder {
  readonly string: PrimSpec;
  readonly number: PrimSpec;
  readonly bool: PrimSpec;
  readonly null: PrimSpec;
  readonly void: PrimSpec;
  readonly duration: PrimSpec;
  readonly size: PrimSpec;
  readonly percent: PrimSpec;
  readonly instant: PrimSpec;
  readonly dynamic: DynamicSpec;
  literal(value: string | number | boolean): LiteralSpec;
  list(element: TypeSpec): ListSpec;
  map(value: TypeSpec): MapSpec;
  record(fields: Readonly<Record<string, TypeSpec>>, options?: RecordOptions): RecordSpec;
  fn(params: readonly TypeSpec[], result: TypeSpec): FnSpec;
  /** A function passed as an argument, which may take fewer params than it is handed. */
  callback(params: readonly TypeSpec[], result: TypeSpec, takes: number): FnSpec;
  union(...members: readonly TypeSpec[]): UnionSpec;
  /** A named handle. `members` is what it publishes; without them, a bare name. */
  opaque(name: string, members?: Readonly<Record<string, TypeSpec>>): OpaqueSpec;
  ref(name: string): RefSpec;
  /**
   * A type this signature is polymorphic in.
   *
   * `t.fn([t.list(t.param("T")), t.callback([t.param("T")], t.param("U"), 1)],
   * t.list(t.param("U")))` is `map`: the same name is the same type within one
   * signature, and every call gets its own.
   */
  param(name: string): ParamSpec;
}

function prim(name: PrimSpec["name"]): PrimSpec {
  return { kind: "prim", name };
}

/**
 * Write a type by hand, for what has no `.d.ts` worth reading.
 *
 * Everything here is data, the same data a generator emits, so an action typed
 * by hand today and typed from its TypeScript tomorrow are the same to every
 * reader downstream.
 */
export const t: TypeBuilder = {
  string: prim("string"),
  number: prim("number"),
  bool: prim("bool"),
  null: prim("null"),
  void: prim("void"),
  duration: prim("duration"),
  size: prim("size"),
  percent: prim("percent"),
  instant: prim("instant"),
  dynamic: { kind: "dynamic" },
  literal: (value) => ({ kind: "literal", value }),
  list: (element) => ({ kind: "list", element }),
  map: (value) => ({ kind: "map", value }),
  record: (fields, options) => ({ kind: "record", fields, ...options }),
  fn: (params, result) => ({ kind: "fn", params, result }),
  callback: (params, result, takes) => ({ kind: "fn", params, result, takes }),
  union: (...members) => ({ kind: "union", members }),
  opaque: (name, members) =>
    members ? { kind: "opaque", name, members } : { kind: "opaque", name },
  ref: (name) => ({ kind: "ref", name }),
  param: (name) => ({ kind: "param", name }),
};
