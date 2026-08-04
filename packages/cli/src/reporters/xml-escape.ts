// biome-ignore-all lint/suspicious/noControlCharactersInRegex: the controls XML 1.0 forbids are exactly what this file exists to find.
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: ${output} is Venn's own interpolation, quoted for a reader.

/**
 * Text as XML 1.0 lets it appear, which is narrower than escaping `<`, `>`, `&`
 * and `"`.
 *
 * A failure message carries whatever the program had in hand, and
 * `fail "${output}"` with output from a coloured CLI carries an ESC byte. XML 1.0
 * forbids nearly every C0 control outright, in element text as much as in an
 * attribute, and gives no character reference for them either, so the byte
 * cannot be encoded around: one of them and a reader rejects the whole document.
 * They are written as the escape a person reads instead, which keeps what was
 * there and still parses.
 */

const TEXT_ESCAPES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
};

/**
 * Whitespace an attribute value has to spell out, because a parser normalises a
 * literal tab, newline or carriage return in one to a space before anybody reads
 * it, and a two-line message would arrive as one.
 */
const ATTRIBUTE_ESCAPES: Record<string, string> = {
  ...TEXT_ESCAPES,
  '"': "&quot;",
  "\t": "&#9;",
  "\n": "&#10;",
  "\r": "&#13;",
};

/** Every C0 control XML 1.0 refuses: all of them but tab, newline and return. */
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/**
 * Escape text that goes between two tags.
 *
 * @param text Whatever a problem had to say.
 * @returns The same text, safe to put in an element's body.
 */
export function escapeText(text: string): string {
  return spelled(text).replace(/[<>&]/g, (char) => TEXT_ESCAPES[char] ?? char);
}

/**
 * Escape text that goes inside a quoted attribute value.
 *
 * @param text Whatever a problem had to say.
 * @returns The same text, safe to put between two quotes and read back whole.
 */
export function escapeAttribute(text: string): string {
  return spelled(text).replace(/[<>&"\t\n\r]/g, (char) => ATTRIBUTE_ESCAPES[char] ?? char);
}

/** A control character as `\u001B`, since XML has no reference to encode it with. */
function spelled(text: string): string {
  const hex = (char: string) => (char.codePointAt(0) ?? 0).toString(16).toUpperCase();
  return text.replace(FORBIDDEN, (char) => `\\u${hex(char).padStart(4, "0")}`);
}
