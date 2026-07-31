/**
 * Reading JSON text, and saying where it stopped making sense.
 *
 * The runtime names a position for most of what can go wrong, and for the rest
 * it quotes the text around it. Either way the message is rewritten so it reads
 * as a sentence about the text rather than as an exception about a parser.
 */

/** What was read, or why it could not be. */
export type Parsed =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: string };

/**
 * Read JSON text into a value.
 *
 * @param text The text to read, from a response, a file or a pipe.
 * @returns The value, or the reason it is not one, with where to look.
 */
export function parseJson(text: string): Parsed {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, reason: reasonFor(error) };
  }
}

/** `in JSON at position 8 (line 1 column 9)`: the part worth keeping is the last. */
const PLACE = /\s*in JSON at position \d+ \(line (\d+) column (\d+)\)/;
/** The other shape, which quotes the text instead of naming a position. */
const QUOTED = /,\s*(\.{3}".*"|".*") is not valid JSON/s;

function reasonFor(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const place = PLACE.exec(message);
  if (place) return `${message.replace(PLACE, "")}, at line ${place[1]} column ${place[2]}`;
  const quoted = QUOTED.exec(message);
  if (quoted) return `${message.replace(QUOTED, "")}, near ${quoted[1]}`;
  return message;
}
