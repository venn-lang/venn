/** What a built-in type is, and how it reads when written. */
export interface BuiltinType {
  /** One line, in the reader's terms rather than the compiler's. */
  doc: string;
  /** How it is written where a type goes. */
  example: string;
}

/**
 * The types the language brings with it, described once.
 *
 * These are the words a reader meets first, so the hover and the completion list
 * read from here. A built-in that cannot explain itself is a built-in nobody
 * discovers.
 */
export const BUILTIN_TYPES: Readonly<Record<string, BuiltinType>> = {
  string: {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Venn's own interpolation, quoted for a reader.
    doc: "Text. Interpolates with `${…}` and carries the string methods.",
    example: "name: string",
  },
  number: {
    doc: "A number, whole or not. There is no separate integer type.",
    example: "age: number",
  },
  bool: {
    doc: "`true` or `false`, and nothing else — no truthiness, no coercion.",
    example: "active: bool",
  },
  null: { doc: "The absence of a value. Written `null`.", example: "found: string | null" },
  void: { doc: "What a verb answers with when it answers nothing.", example: "-> void" },
  dynamic: {
    doc: "A value whose shape nothing can know — a parsed response, a JSON field. Name a type and annotate a binding to give it one.",
    example: "const price: Price = res.json",
  },
  list: { doc: "Many of one thing, in order.", example: "tags: list<string>" },
  map: { doc: "Keys not known ahead of time, values all alike.", example: "headers: map<string>" },
  duration: {
    doc: "A length of time: `500ms`, `2s`, `1m`. Arithmetic keeps the unit.",
    example: "timeout: duration",
  },
  size: {
    doc: "A size in bytes: `4kb`, `2mb`. Arithmetic keeps the unit.",
    example: "limit: size",
  },
  percent: {
    doc: "A proportion: `5%`, `99.9%`. Reads back as `.ratio` or `.percent`.",
    example: "rate: percent",
  },
  instant: {
    doc: "A moment in time, written as an ISO date: `2026-07-27T12:00:00Z`.",
    example: "at: instant",
  },
  never: {
    doc: "What a verb that always fails answers with. No value has this type.",
    example: "-> never",
  },
};

/** Whether a name is one of the language's own types. */
export function isBuiltinType(name: string): boolean {
  return name in BUILTIN_TYPES;
}
