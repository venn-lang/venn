import { isLeafValue } from "@venn-lang/sdk";
import type { Show } from "./render.types.js";

/**
 * Renders a value as indented XML.
 *
 * A map's keys become tags; a list repeats the tag it was given, once per item.
 * Text is escaped. Attributes are never produced, so a round trip through this
 * and back is not the identity.
 *
 * Text is written with `show`, the language's own writer, so `250ms` is
 * `<took>250ms</took>`. This file used to walk into it and emit
 * `<took><kind>duration</kind><ms>250</ms></took>`.
 *
 * @param args.value What to render.
 * @param args.show The language's writer for a single value.
 * @param args.tag The name of the outermost element. `root` by default.
 * @param args.indent Depth to start at, two spaces per level. The recursion sets it.
 * @returns The XML text, with no declaration or prologue.
 */
export function toXml(args: { value: unknown; show: Show; tag?: string; indent?: number }): string {
  const { value, show, tag = "root", indent = 0 } = args;
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) return value.map((item) => toXml({ ...args, value: item })).join("\n");
  if (isMap(value)) return element({ tag, body: children(value, show, indent), pad, block: true });
  return element({ tag, body: escaped(text(value, show)), pad, block: false });
}

function children(map: Record<string, unknown>, show: Show, indent: number): string {
  return Object.entries(map)
    .map(([key, item]) => toXml({ value: item, show, tag: key, indent: indent + 1 }))
    .join("\n");
}

function element(args: { tag: string; body: string; pad: string; block: boolean }): string {
  const { tag, body, pad } = args;
  if (!args.block) return `${pad}<${tag}>${body}</${tag}>`;
  return body === "" ? `${pad}<${tag}/>` : `${pad}<${tag}>\n${body}\n${pad}</${tag}>`;
}

/**
 * A map is structure whose keys become tags. A leaf is not: the host sees an
 * object, the language sees the single word `250ms` or `regex(r"a-z", "i")`.
 */
function isMap(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return !isLeafValue(value);
}

function text(value: unknown, show: Show): string {
  return value === null || value === undefined ? "" : show(value);
}

function escaped(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
