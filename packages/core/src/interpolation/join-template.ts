import { isUnitValue, type UnitValue } from "../units/index.js";

/**
 * How a filled placeholder reads. One definition, because a title and a string
 * showing the same value must not disagree about what it looks like.
 *
 * @param value What the placeholder evaluated to.
 * @returns Its text. Nothing at all for null and undefined, since a title
 * reading `add ${name}` with no name is better as `add ` than as `add null`.
 */
export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (isUnitValue(value)) return stringifyUnit(value);
  return String(value);
}

function stringifyUnit(value: UnitValue): string {
  if (value.kind === "duration") return `${value.ms}ms`;
  if (value.kind === "size") return `${value.bytes}b`;
  return `${value.ratio * 100}%`;
}

/**
 * The text around the placeholders, with the placeholders filled.
 *
 * @param chunks The literal text, one entry more than there are values.
 * @param values What each placeholder evaluated to, in order.
 * @returns The whole string.
 */
export function joinTemplate(chunks: readonly string[], values: readonly unknown[]): string {
  let out = chunks[0] ?? "";
  for (let at = 0; at < values.length; at += 1) {
    out += stringifyValue(values[at]) + (chunks[at + 1] ?? "");
  }
  return out;
}
