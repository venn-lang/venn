import { isLeafValue } from "@venn-lang/sdk";
import type { Show } from "./render.types.js";

/**
 * Renders a value as YAML: maps, lists and scalars, two spaces per level.
 *
 * A string is quoted only where plain style would change what it means. Empty
 * maps and lists print as `{}` and `[]`, since a block with nothing under it
 * would read as an absent value.
 *
 * A scalar is written with `show`, the language's own writer, so `250ms` is one
 * line reading `250ms`. This file used to walk into it and open a block for
 * `kind` and `ms`.
 *
 * @param value What to render.
 * @param show The language's writer for a single value.
 * @param indent Depth to start at. The recursion sets it.
 * @returns The YAML text, with no document marker.
 */
export function toYaml(value: unknown, show: Show, indent = 0): string {
  if (Array.isArray(value)) return listYaml(value, show, indent);
  if (isMap(value)) return mapYaml(value, show, indent);
  return `${padding(indent)}${scalar(value, show)}`;
}

/** The two spaces per level every line at this depth opens with. */
function padding(indent: number): string {
  return "  ".repeat(indent);
}

function listYaml(items: readonly unknown[], show: Show, indent: number): string {
  const pad = padding(indent);
  if (items.length === 0) return `${pad}[]`;
  return items.map((item) => `${pad}- ${nested(item, show, indent)}`).join("\n");
}

function mapYaml(map: Record<string, unknown>, show: Show, indent: number): string {
  const pad = padding(indent);
  const entries = Object.entries(map);
  if (entries.length === 0) return `${pad}{}`;
  return entries.map(([key, item]) => `${pad}${key}:${suffix(item, show, indent)}`).join("\n");
}

/** A scalar sits on the key's line; a map or list opens a block below it. */
function suffix(value: unknown, show: Show, indent: number): string {
  if (isEmpty(value)) return ` ${Array.isArray(value) ? "[]" : "{}"}`;
  if (Array.isArray(value) || isMap(value)) return `\n${toYaml(value, show, indent + 1)}`;
  return ` ${scalar(value, show)}`;
}

/** A nested value under `- `, with its first line already positioned. */
function nested(value: unknown, show: Show, indent: number): string {
  if (isEmpty(value) || (!Array.isArray(value) && !isMap(value))) return scalar(value, show);
  return toYaml(value, show, indent + 1).trimStart();
}

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return isMap(value) && Object.keys(value).length === 0;
}

/**
 * A map is structure to walk into. A leaf is not: the host sees an object, the
 * language sees the single word `250ms` or `regex(r"a-z", "i")`, and this is
 * the one place that difference has to be noticed for the whole file to respect
 * it.
 */
function isMap(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return !isLeafValue(value);
}

const PLAIN = /^[A-Za-z_][\w .-]*$/;

function scalar(value: unknown, show: Show): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "string") return show(value);
  return value === "" || !PLAIN.test(value) ? JSON.stringify(value) : value;
}
