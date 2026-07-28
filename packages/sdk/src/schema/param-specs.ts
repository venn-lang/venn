import type { ZodType } from "zod";
import type { ParamSpec } from "./params.types.js";

/** The bits of a Zod schema this reads. Structural, so no Zod internals leak out. */
interface ZodNode {
  description?: string;
  options?: readonly string[];
  shape?: Record<string, unknown>;
  def?: { type?: string; innerType?: unknown; shape?: Record<string, unknown> };
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

function typeNameOf(node: ZodNode | undefined): string {
  const kind = node?.def?.type ?? "";
  if (kind === "enum") return (node?.options ?? []).map((value) => `"${value}"`).join(" | ");
  return TYPE_NAMES[kind] ?? kind ?? "any";
}

function shapeOf(schema: unknown): Record<string, unknown> | undefined {
  const node = schema as ZodNode | undefined;
  if (node?.shape) return node.shape;
  if (node?.def?.shape) return node.def.shape;
  const inner = node?.def?.innerType;
  return inner ? shapeOf(inner) : undefined;
}
