import type { ZodType } from "zod";
import type { ParamSpec } from "./params.types.js";

/** The bits of a Zod schema this reads. Structural, so no Zod internals leak out. */
interface ZodNode {
  description?: string;
  options?: readonly string[];
  shape?: Record<string, unknown>;
  def?: { type?: string; innerType?: unknown; in?: unknown; shape?: Record<string, unknown> };
  meta?: () => { venn?: unknown } | undefined;
}

const TYPE_NAMES: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  bigint: "number",
  record: "map",
  object: "map",
  array: "list",
  unknown: "any",
  any: "any",
};

/**
 * Read an action's params schema into something the editor can offer, document
 * and check. The schema is the single source: a key documented with
 * `.describe()` needs no second list that drifts out of date.
 *
 * @param schema The action's `params` schema, or nothing.
 * @returns One spec per key of the options map, empty when the schema is absent
 * or has no object shape.
 */
export function paramSpecs(schema: ZodType | undefined): ParamSpec[] {
  const shape = shapeOf(schema);
  if (!shape) return [];
  return Object.entries(shape).map(([name, value]) => specOf(name, value as ZodNode));
}

/** Just the key names of {@link paramSpecs}, for the compact hover line. */
export function paramNames(schema: ZodType | undefined): string[] {
  return paramSpecs(schema).map((spec) => spec.name);
}

/**
 * The schema declared for one key of an action's params, or nothing when the
 * params declare no such key.
 *
 * {@link paramSpecs} says what a key is called and what type it takes; this
 * hands back the schema itself, so a checker can hold a written value to
 * exactly what the run will hold it to rather than to a second opinion about
 * what that type means.
 *
 * @param schema The action's `params` schema, read structurally, so a caller
 * holding it as `unknown` need not assert a Zod type to ask.
 * @param key The option name.
 * @returns That key's schema, or `undefined` when the key is not declared.
 */
export function paramSchema(schema: unknown, key: string): ZodType | undefined {
  const declared = shapeOf(schema)?.[key];
  // Every value in a Zod object's shape is a schema; the shape is read
  // structurally, so the compiler only sees `unknown`.
  return declared as ZodType | undefined;
}

function specOf(name: string, node: ZodNode): ParamSpec {
  const wrapper = node?.def?.type;
  const inner = unwrap(node);
  return {
    name,
    type: typeNameOf(inner),
    doc: node?.description,
    required: wrapper !== "optional" && wrapper !== "default",
    values: inner?.options,
  };
}

/** `z.string().optional()` describes a string; the wrapper only says it may be absent. */
function unwrap(node: ZodNode | undefined): ZodNode | undefined {
  const inner = node?.def?.innerType as ZodNode | undefined;
  return inner ? unwrap(inner) : node;
}

/**
 * What to call this schema's type, in the language's words.
 *
 * A schema built out of steps has no structural name: `Duration` is a `ZodPipe`
 * whose input is a union, and reading its `def.type` put the word `pipe` in the
 * editor's hover and `${1:pipe}` in the completion snippet. A schema that knows
 * what it is says so with `.meta({ venn })`, which is also what makes the
 * checker's duration branch reachable.
 */
function typeNameOf(node: ZodNode | undefined): string {
  const named = node?.meta?.()?.venn;
  if (typeof named === "string") return named;
  const kind = node?.def?.type ?? "";
  if (kind === "enum") return (node?.options ?? []).map((value) => `"${value}"`).join(" | ");
  if (kind === "pipe") return typeNameOf(node?.def?.in as ZodNode | undefined);
  return TYPE_NAMES[kind] ?? kind ?? "any";
}

function shapeOf(schema: unknown): Record<string, unknown> | undefined {
  const node = schema as ZodNode | undefined;
  if (node?.shape) return node.shape;
  if (node?.def?.shape) return node.def.shape;
  const inner = node?.def?.innerType;
  return inner ? shapeOf(inner) : undefined;
}
