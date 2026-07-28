/**
 * Renders a value as YAML: maps, lists and scalars, two spaces per level.
 *
 * A string is quoted only where plain style would change what it means. Empty
 * maps and lists print as `{}` and `[]`, since a block with nothing under it
 * would read as an absent value.
 *
 * @param value What to render.
 * @param indent Depth to start at. The recursion sets it.
 * @returns The YAML text, with no document marker.
 */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) return listYaml(value, indent, pad);
  if (isMap(value)) return mapYaml(value, indent, pad);
  return `${pad}${scalar(value)}`;
}

function listYaml(items: readonly unknown[], indent: number, pad: string): string {
  if (items.length === 0) return `${pad}[]`;
  return items.map((item) => `${pad}- ${nested(item, indent)}`).join("\n");
}

function mapYaml(map: Record<string, unknown>, indent: number, pad: string): string {
  const entries = Object.entries(map);
  if (entries.length === 0) return `${pad}{}`;
  return entries.map(([key, item]) => `${pad}${key}:${suffix(item, indent)}`).join("\n");
}

/** A scalar sits on the key's line; a map or list opens a block below it. */
function suffix(value: unknown, indent: number): string {
  if (isEmpty(value)) return ` ${Array.isArray(value) ? "[]" : "{}"}`;
  if (Array.isArray(value) || isMap(value)) return `\n${toYaml(value, indent + 1)}`;
  return ` ${scalar(value)}`;
}

/** A nested value under `- `, with its first line already positioned. */
function nested(value: unknown, indent: number): string {
  if (isEmpty(value) || (!Array.isArray(value) && !isMap(value))) return scalar(value);
  return toYaml(value, indent + 1).trimStart();
}

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return isMap(value) && Object.keys(value).length === 0;
}

function isMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const PLAIN = /^[A-Za-z_][\w .-]*$/;

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "string") return String(value);
  return value === "" || !PLAIN.test(value) ? JSON.stringify(value) : value;
}
