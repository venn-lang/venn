import type { RecordType, Type } from "./type.types.js";
import { prune } from "./unify.js";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Render one type for a hover or a diagnostic, naming variables `a`, `b`, … */
export function showType(type: Type): string {
  return render(type, new Map());
}

/**
 * Several types that belong together, named as one.
 *
 * Rendering them one at a time restarts the alphabet each time, so the two
 * unrelated parameters of `fn (nome, idade)` would both come back as `a`. That
 * says they are the same type, which is the opposite of what is known.
 */
export function showTypes(types: readonly Type[]): string[] {
  const names = new Map<number, string>();
  return types.map((type) => render(type, names));
}

function render(type: Type, names: Map<number, string>): string {
  const t = prune(type);
  switch (t.kind) {
    case "prim":
      return t.name;
    case "dynamic":
      return "dynamic";
    case "var":
      return nameOf(t.id, names);
    case "list":
      return `list<${render(t.element, names)}>`;
    case "fn":
      return `fn(${t.params.map((p) => render(p, names)).join(", ")}) -> ${render(t.result, names)}`;
    case "record":
      return renderRecord(t, names);
    case "literal":
      return typeof t.value === "string" ? `"${t.value}"` : String(t.value);
    case "union":
      return t.members.map((m) => render(m, names)).join(" | ");
    case "opaque":
      return t.name;
  }
}

/** Named keys read as a shape; unnamed ones read as the map they are. */
function renderRecord(type: RecordType, names: Map<number, string>): string {
  const rest = type.rest ? `map<${render(type.rest, names)}>` : undefined;
  if (type.fields.size === 0) return rest ?? "{}";
  const body = [...type.fields]
    .map(([name, field]) => `${name}: ${render(field, names)}`)
    .join(", ");
  return `{ ${body}${rest ? `, …: ${render(type.rest as Type, names)}` : ""} }`;
}

function nameOf(id: number, names: Map<number, string>): string {
  const existing = names.get(id);
  if (existing) return existing;
  const index = names.size;
  const name = index < LETTERS.length ? (LETTERS[index] as string) : `t${index}`;
  names.set(id, name);
  return name;
}
