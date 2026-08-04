/**
 * What the parser and the lexer refused, said as one line about the file.
 *
 * Chevrotain writes for the person who wrote the grammar: it names token types,
 * byte offsets and the recovery strategy it chose, and one of its messages runs
 * to 180 lines listing every sequence that would have fitted. All of that went
 * into a Problem's title, so it reached stderr, the editor and the ndjson
 * stream unchanged. A title is one line about somebody's file, and this is
 * where a vendor sentence becomes one.
 */

import { saidToken } from "./token-words.js";

/** Beyond this many, naming each one is a list nobody reads to the end. */
const NAMED = 3;

/** `Expecting token of type 'X' but found …`: the one thing that could go here. */
const ONE_EXPECTED = /token of type '([^']+)'/;

/** `1. [step, STRING]`: one of the sequences offered when several would fit. */
const A_SEQUENCE = /^\s*\d+\.\s*\[([^\]]*)\]/gm;

/** `unexpected character: ->x<- at offset: 10, skipped 1 characters.` */
const A_CHARACTER = /unexpected character: ->([\s\S])<-/;

/** What the lexer reports a bracket nobody closed by, so this can say it. */
const UNCLOSED = /unclosed bracket: ->(.)<-/;

/**
 * A parse error, in the language's own voice.
 *
 * @param args The parser's message, and the text of the token it stopped at.
 * @returns One line naming what could have gone there and what was written
 * instead, and never the parser's own words.
 */
export function saidParserError(args: { message: string; image: string }): string {
  const found = saidToken(args.image);
  const expected = expectedNames(args.message);
  if (expected.length > 0) return `Expected ${listed(expected)} here, found ${found}.`;
  if (args.image === "") return "The file ends before this is finished.";
  return `${found.charAt(0).toUpperCase()}${found.slice(1)} cannot go here.`;
}

/**
 * A lexing error, in the language's own voice.
 *
 * @param message The lexer's message, or the one the bracket check wrote.
 * @returns One line about the character or the bracket it was raised for.
 */
export function saidLexerError(message: string): string {
  const unclosed = UNCLOSED.exec(message)?.[1];
  if (unclosed) {
    return `This \`${unclosed}\` is never closed, so the rest of the file is read as part of it.`;
  }
  const character = A_CHARACTER.exec(message)?.[1];
  if (character) return `\`${character}\` is not a character Venn can read.`;
  return "Venn cannot read this part of the file.";
}

/**
 * Whether a lexing error is a bracket nobody closed.
 *
 * @param message The lexer's message.
 * @returns true when everything the parser said past it is the wake of this.
 */
export function isUnclosedBracket(message: string): boolean {
  return UNCLOSED.test(message);
}

/**
 * Everything that could have stood where the parser stopped.
 *
 * A mismatched token names one. An alternation names a numbered sequence per
 * branch, and only the first token of each is a thing that could have been
 * written next, so the rest of the sequence is dropped.
 */
function expectedNames(message: string): string[] {
  const one = ONE_EXPECTED.exec(message)?.[1];
  if (one) return [one];
  const found: string[] = [];
  for (const [, sequence] of message.matchAll(A_SEQUENCE)) {
    const first = (sequence ?? "").split(",")[0]?.trim();
    if (first && !found.includes(first)) found.push(first);
  }
  return found;
}

/**
 * The names as a phrase, stopping after the ones it names.
 *
 * It used to end with `or one of 25 other things`, which is the parser counting
 * its own alternatives out loud. Nobody writing a file cares how many branches
 * the grammar has at that point; they care about the three worth trying.
 */
function listed(names: string[]): string {
  const said = names.slice(0, NAMED).map(saidToken);
  if (said.length === 1) return said[0] as string;
  return `${said.slice(0, -1).join(", ")} or ${said.at(-1)}`;
}
