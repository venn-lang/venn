/**
 * What a token is called, in the words of somebody writing Venn.
 *
 * The parser names a token by its type (`ID`, `STRING`) or by the character it
 * is (`:`), and both went straight into a title, where a reader met the naming
 * scheme of a parser generator instead of a sentence about their own file.
 *
 * A Map rather than an object literal: a lookup keyed on text that came out of
 * a source file answers for `constructor` and `toString` on an object, and what
 * comes back from those is not a string.
 */
const WORDS = new Map<string, string>([
  ["ID", "a name"],
  ["STRING", "some text"],
  ["BLOCK_STRING", "a block of text"],
  ["RAW_STRING", "some raw text"],
  ["NUMBER", "a number"],
  ["INSTANT", "a date and time"],
  ["NL", "the end of the line"],
  ["EOF", "the end of the file"],
  ["", "the end of the file"],
  [":", "a colon"],
  [",", "a comma"],
  [".", "a dot"],
  ["?.", "an optional dot"],
  ["...", "three dots"],
  [";", "a semicolon"],
  ["(", "an opening bracket"],
  [")", "a closing bracket"],
  ["[", "an opening square bracket"],
  ["]", "a closing square bracket"],
  ["{", "an opening brace"],
  ["}", "a closing brace"],
  ["=", "an equals sign"],
  ["=>", "an arrow"],
  ["->", "an arrow"],
  ["|", "a bar"],
  ["@", "an at sign"],
  ["*", "a star"],
]);

/** Long enough to recognise the token by, short enough to keep a title one line. */
const SHOWN = 24;

/**
 * The token, in words.
 *
 * @param name A token type name (`ID`), or the text of the token itself (`:`).
 * @returns The noun for it, or the token quoted, which is the most that can be
 * said about a keyword or an operator nobody has a word for.
 */
export function saidToken(name: string): string {
  // Whitespace and `;` are one token, and neither reads back as itself.
  const said = WORDS.get(name !== "" && name.trim() === "" ? "NL" : name);
  if (said) return said;
  // A title is a line, and a token can carry a whole block of text.
  const oneLine = name.replace(/\s+/g, " ").trim();
  return `\`${oneLine.length > SHOWN ? `${oneLine.slice(0, SHOWN)}…` : oneLine}\``;
}
