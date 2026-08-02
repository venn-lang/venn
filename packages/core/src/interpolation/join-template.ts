import { stringifyValue } from "./stringify-value.js";

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
