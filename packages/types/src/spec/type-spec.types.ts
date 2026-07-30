/**
 * The wire format of a Venn type.
 *
 * Plain data: no functions, no `Map`s, no inference variables, so a `TypeSpec`
 * survives `JSON.stringify`. That is what lets a plugin hand-write one and a
 * generator emit the very same bytes from a `.d.ts`. The compiler's own `Type`,
 * with its unification variables, is a separate internal thing; nothing mutable
 * ever lands here.
 *
 * Deliberately smaller than TypeScript's type system. Everything TS can say
 * projects onto these ten shapes or degrades to {@link DynamicSpec}, never to a
 * failure. Generics, conditional and mapped types are resolved by the TypeScript
 * compiler at generation time, so what arrives here is the answer, not the
 * machinery.
 */
export type TypeSpec =
  | PrimSpec
  | LiteralSpec
  | ListSpec
  | MapSpec
  | RecordSpec
  | FnSpec
  | UnionSpec
  | OpaqueSpec
  | RefSpec
  | ParamSpec
  | DynamicSpec;

/** The scalars, including the units the language treats as first class. */
export type PrimName =
  | "string"
  | "number"
  | "bool"
  | "null"
  | "void"
  | "duration"
  | "size"
  | "percent"
  | "instant";

/** One of the scalars named by {@link PrimName}. */
export interface PrimSpec {
  readonly kind: "prim";
  readonly name: PrimName;
}

/** A single value: `"GET"`, `200`, `true`. What makes an enum an enum. */
export interface LiteralSpec {
  readonly kind: "literal";
  readonly value: string | number | boolean;
}

/** Any number of values of one type. The language has no fixed-length list. */
export interface ListSpec {
  readonly kind: "list";
  readonly element: TypeSpec;
}

/** Keys not known ahead of time, values all alike: TS's `Record<string, T>`. */
export interface MapSpec {
  readonly kind: "map";
  readonly value: TypeSpec;
}

/** Known fields. `open` tolerates extra ones; `optional` lists what may be absent. */
export interface RecordSpec {
  readonly kind: "record";
  readonly fields: Readonly<Record<string, TypeSpec>>;
  readonly optional?: readonly string[];
  readonly open?: boolean;
}

/** A callable: what it is given, in order, and what it gives back. */
export interface FnSpec {
  readonly kind: "fn";
  readonly params: readonly TypeSpec[];
  readonly result: TypeSpec;
  /**
   * How many parameters the caller must actually take. A callback handed more
   * than it needs is still a good callback, as with `req => …` against a handler
   * that is also offered the server.
   */
  readonly takes?: number;
}

/** A value that is any one of the members. */
export interface UnionSpec {
  readonly kind: "union";
  readonly members: readonly TypeSpec[];
}

/**
 * A handle with a name and no visible inside: a socket, a browser, an
 * `express.Application`.
 *
 * This is the border. Projecting a JS class as a record would drag its whole
 * object graph (`EventEmitter`, symbols, a hundred inherited members) into a
 * language that means none of it. An opaque type can be held and handed to the
 * verbs of its namespace, and nothing else.
 */
export interface OpaqueSpec {
  readonly kind: "opaque";
  /**
   * What a program may do with it, such as `{ port, close }` on a server.
   *
   * Opaque is about the *inside* being none of the reader's business, not about
   * having nothing to offer. With none of these the handle is a name and no
   * more, which is right for something only its own verbs ever touch.
   */
  readonly members?: Readonly<Record<string, TypeSpec>>;
  readonly name: string;
}

/**
 * A type this signature is polymorphic in: the `T` of `map(list<T>, fn(T) -> U)`.
 *
 * Two params of the same name in one signature are the same type, and each use
 * of the signature gets its own: calling `map` on a `list<string>` must not
 * decide what `T` is for every other call.
 *
 * Only meaningful inside a signature. A published *type* that carried one would
 * be a type nobody can name, since there is nowhere to say what it stands for.
 */
export interface ParamSpec {
  readonly kind: "param";
  /** How it is written, and what makes two of them the same: `"T"`, `"U"`. */
  readonly name: string;
}

/** A named type resolved through the catalog: `http.Request`, `User`. */
export interface RefSpec {
  readonly kind: "ref";
  readonly name: string;
}

/** Unknown, and deliberately so. Unifies with everything, never errors. */
export interface DynamicSpec {
  readonly kind: "dynamic";
}

/** What a plugin publishes: its named types, and one signature per action. */
export interface TypeManifest {
  /** Fully qualified: `http.Request`. */
  readonly types?: Readonly<Record<string, TypeSpec>>;
  /** Keyed by action name within the namespace: `serve`, `on`. */
  readonly actions?: Readonly<Record<string, FnSpec>>;
}
