/**
 * When a key means a position rather than a name.
 *
 * A list and a string are read by position, and a key arrives as either a
 * number or the text of one: `xs[0]`, `xs["0"]` and `xs[k]` with `k` bound to
 * `"0"` all ask for the first element. Asked in one place because the run and
 * the checker have to agree: while the checker called `xs["0"]` a member and the
 * run called it a position, one of them was always wrong about the same key.
 */

/**
 * The position a key spells, when it spells one.
 *
 * Only the canonical spelling counts. `"00"`, `" 0"`, `"1e2"` and `"-1"` are
 * names, because a key that reads back as different text is not the number it
 * was written as, and a map is allowed to carry any of them as a field.
 *
 * @param key The key, already text, however the source wrote it.
 * @returns The position, or undefined when the key is a name.
 */
export function positionKey(key: string): number | undefined {
  const spot = Number(key);
  return Number.isInteger(spot) && spot >= 0 && String(spot) === key ? spot : undefined;
}
