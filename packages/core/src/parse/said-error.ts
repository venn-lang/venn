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

import { orPhrase } from "../problem/index.js";
import { SEMICOLON_IN_BRACKETS } from "./separator-words.js";
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

/** What the lexer reports a `;` written where only a comma can go by. */
const A_SEPARATOR = /separator in brackets: ->;<-/;

/** `mismatched bracket: ->}<- against ->(<- expected ->)<-`: the three characters. */
const MISMATCHED = /mismatched bracket: ->(.)<- against ->(.)<- expected ->(.)<-/;

/** `dangling separator: ->;<- before ->]<-`: a `;` with nothing after it. */
const DANGLING = /dangling separator: ->;<- before ->(.)<-/;

/** `opened at offset: 5`: where the bracket a mismatch left standing begins. */
const OPENED = /opened at offset: (\d+)/;

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
  const mismatch = MISMATCHED.exec(message);
  if (mismatch) return saidMismatch(mismatch);
  const dangling = DANGLING.exec(message)?.[1];
  if (dangling) return saidDangling(dangling);
  if (A_SEPARATOR.test(message)) return SEMICOLON_IN_BRACKETS;
  const character = A_CHARACTER.exec(message)?.[1];
  if (character) return `\`${character}\` is not a character Venn can read.`;
  return "Venn cannot read this part of the file.";
}

/**
 * A closer that closes the wrong bracket, told as the character it should be.
 *
 * @param found The closer written, the bracket still open, and the one wanted.
 * @returns One line naming all three, since the fix is the third of them.
 */
function saidMismatch(found: RegExpExecArray): string {
  const [, closer, opener, wanted] = found;
  const said = `This \`${closer}\` does not close the \`${opener}\` that is still open.`;
  return `${said} Write \`${wanted}\` here.`;
}

/**
 * A `;` with nothing after it before the closer, which separates nothing.
 *
 * The separating case is told to write a comma, and that answer is wrong here:
 * an argument list refuses a trailing comma, so following it turns `print(1;)`
 * into `print(1,)` and earns the report about the end of the file that this
 * whole walk exists to spare a reader. Nothing is missing; a character is spare.
 *
 * @param closer The bracket standing immediately after the `;`.
 * @returns One line naming both characters and the one way out that compiles.
 */
function saidDangling(closer: string): string {
  const said = `Nothing follows this \`;\` before the \`${closer}\`, so it separates nothing.`;
  return `${said} Remove it.`;
}

/**
 * Where the parser stops being believed, given one lexing error, or nothing.
 *
 * Both bracket faults answer, and for one reason: the `(` is still open. A
 * bracket nobody closed obviously swallows the rest of the file, and a closer
 * that closes the wrong one leaves the opener standing exactly as it was, so
 * the newlines after it go on being read as part of the bracket. What the
 * parser reaches from there is the wake of the character already reported, and
 * a second sentence about it is a second mistake the reader has not made.
 *
 * The two answer with different offsets, which is the whole reason this returns
 * one rather than a yes. An unclosed bracket is raised AT its opener, so the
 * error's own offset is where the wake begins. A mismatch is raised at the
 * closer, and the parser's complaint about the opener sits earlier than that:
 * `print(1}` reports the `}` at column 8 and wants the file to have ended at
 * the `(` in column 6. Cutting from the closer would keep that second sentence.
 *
 * @param error The lexer's message and the offset it was raised at.
 * @returns The offset past which the parser is echoing this, or `undefined`.
 */
export function wakeStartsAt(error: { message: string; offset: number }): number | undefined {
  const opened = OPENED.exec(error.message);
  if (opened) return Number(opened[1]);
  return UNCLOSED.test(error.message) ? error.offset : undefined;
}

/**
 * Everything that could have stood where the parser stopped.
 *
 * A mismatched token names one. An alternation names a numbered sequence per
 * branch, and only the first token of each is a thing that could have been
 * written next, so the rest of the sequence is dropped.
 *
 * Exported because an explainer keyed on the parser's own state needs the token
 * it wanted, and reading Chevrotain's wording is this module's job and not
 * something to do a second time somewhere else.
 *
 * @param message The parser's message.
 * @returns The token names, empty where the parser named none.
 */
export function expectedNames(message: string): string[] {
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
 * the grammar has at that point; they care about the three worth trying. The
 * cap is this module's; the phrase belongs to `orPhrase`, which the type
 * checker's uncovered-case line uses too.
 */
function listed(names: string[]): string {
  return orPhrase(names.slice(0, NAMED).map(saidToken));
}
