/**
 * Renders a value as indented XML.
 *
 * A map's keys become tags; a list repeats the tag it was given, once per item.
 * Text is escaped. Attributes are never produced, so a round trip through this
 * and back is not the identity.
 *
 * @param value What to render.
 * @param tag The name of the outermost element.
 * @param indent Depth to start at, two spaces per level. The recursion sets it.
 * @returns The XML text, with no declaration or prologue.
 */
export function toXml(value: unknown, tag = "root", indent = 0): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) return value.map((item) => toXml(item, tag, indent)).join("\n");
  if (isMap(value)) return element({ tag, body: children(value, indent), pad, block: true });
  return element({ tag, body: escaped(text(value)), pad, block: false });
}

function children(map: Record<string, unknown>, indent: number): string {
  return Object.entries(map)
    .map(([key, item]) => toXml(item, key, indent + 1))
    .join("\n");
}

function element(args: { tag: string; body: string; pad: string; block: boolean }): string {
  const { tag, body, pad } = args;
  if (!args.block) return `${pad}<${tag}>${body}</${tag}>`;
  return body === "" ? `${pad}<${tag}/>` : `${pad}<${tag}>\n${body}\n${pad}</${tag}>`;
}

function isMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function escaped(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
