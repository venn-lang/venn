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

/**
 * Names quoted and joined the way a sentence wants them.
 *
 * One owner, because two diagnostics list field names and a reader who meets
 * both should not have to notice that they punctuate differently.
 *
 * @param names One or more, in the order they should be read.
 * @returns `"a"`, `"a" and "b"`, or `"a", "b" and "c"`.
 */
export function namedList(names: readonly string[]): string {
  const quoted = names.map((name) => `"${name}"`);
  if (quoted.length <= 1) return quoted.join("");
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}

function render(type: Type, names: Map<number, string>): string {
  const t = prune(type);
  // The name a `type` gave it, which is what the reader wrote and what every
  // other line of their file calls it. The shape is what they declared once, at
  // the declaration, precisely so they would not have to read it again here.
  if (t.named !== undefined) return t.named;
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
      return t.members.map((m) => inUnion(m, names)).join(" | ");
    case "opaque":
      return t.name;
  }
}

/**
 * A member of a union, bracketed where reading it flat would say the wrong type.
 *
 * `->` reads looser than `|`, so a nullable function printed bare comes out as
 * `fn() -> number | null`, which a reader parses as a function returning a
 * nullable number. It is the opposite: the function itself may be missing, and
 * that is exactly why calling it is refused.
 */
function inUnion(member: Type, names: Map<number, string>): string {
  const said = render(member, names);
  return prune(member).kind === "fn" ? `(${said})` : said;
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
