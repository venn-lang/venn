import { DefaultLexer, type LexerResult, type TokenizeOptions } from "langium";
import { BOM } from "./byte-order-mark.js";

/** A single lexed token; NL suppression keys off its token-type name. */
type Token = LexerResult["tokens"][number];

/** One lexing error, in the shape the parse layer reads them back in. */
type LexingError = LexerResult["errors"][number];

/**
 * Every bracket, as characters rather than keyed tables.
 *
 * Each set is tested against a token-type name, which for a keyword is the
 * keyword itself, and an object read by such a name answers for `constructor`
 * and `toString` as readily as for `(`. A character lookup cannot: the grammar
 * is free to name a keyword whatever it likes and none of this moves.
 */
const DROPS_NEWLINES = "([";
/** The bracket that gives newlines back: a block, a map, a shape. */
const KEEPS_NEWLINES = "{";
/** Closers, in the order their openers are written above, so a pair is an index. */
const CLOSERS = ")]}";
/** The openers in that same order, so a bracket and its closer share an index. */
const OPENERS = `${DROPS_NEWLINES}${KEEPS_NEWLINES}`;

/**
 * Makes `NL` (a newline or `;`) significant between statements, but suppresses
 * it inside `( )` and `[ ]` so calls, arg lists and list literals may still
 * span multiple physical lines. Blocks and maps (`{ }`) keep their newlines,
 * including where one is written inside a call: the newline is the only thing
 * that ends a statement, so a block that lost it could hold nothing but its
 * last expression.
 *
 * That suppression is also why an unclosed `(` is worth its own error: with the
 * newlines gone the rest of the file is one statement, and no other mistake in
 * it can be reported. Which is why the stack only ever discharges a bracket on
 * the closer that matches it, and why a `;` written where a comma belongs is
 * refused out loud rather than disappearing into the suppression.
 *
 * The one newline dropped outside a bracket is the one above a line that opens
 * with `.`, so a long chain may be broken over lines the way a reader breaks it.
 */
export class VennLexer extends DefaultLexer {
  override tokenize(text: string, options?: TokenizeOptions): LexerResult {
    const marked = text.startsWith(BOM);
    // Written over rather than cut out, so every offset after it is where it
    // was and each span still points where it pointed. The columns it leaves
    // one place to the right on line one are moved at the Problem boundary, by
    // `shownColumn`, and never here: Langium builds `$cstNode.range` out of
    // these very columns and `$cstNode.offset` out of the offsets, so a token
    // whose column had been shifted gave one CST node a range and an offset
    // that disagreed, and rename rewrote five characters beside the name.
    const result = super.tokenize(marked ? ` ${text.slice(BOM.length)}` : text, options);
    const walked = suppressBracketedNewlines(result.tokens);
    result.tokens = walked.tokens;
    result.errors = [...result.errors, ...walked.errors];
    return result;
  }
}

/** What the walk leaves behind: the stream, and everything it refused. */
interface Walked {
  readonly tokens: Token[];
  readonly errors: LexingError[];
}

/** What one token does to the stream: whether it stays, and what it earned. */
interface Verdict {
  readonly kept: boolean;
  readonly error?: LexingError;
}

function suppressBracketedNewlines(tokens: Token[]): Walked {
  const kept: Token[] = [];
  const open: Token[] = [];
  const errors: LexingError[] = [];
  for (const [index, token] of tokens.entries()) {
    const verdict = weigh({ token, tokens, index, open });
    if (verdict.error) errors.push(verdict.error);
    if (verdict.kept) kept.push(token);
  }
  const swallowed = open.filter((token) => DROPS_NEWLINES.includes(token.tokenType.name));
  errors.push(...swallowed.map(unclosedError));
  return { tokens: kept, errors: errors.sort((one, other) => one.offset - other.offset) };
}

/**
 * What becomes of one token, given the brackets standing open above it.
 *
 * `open` is pushed and popped here, since that stack is the only state the walk
 * carries from one token to the next.
 */
function weigh(args: { token: Token; tokens: Token[]; index: number; open: Token[] }): Verdict {
  const { token, open } = args;
  const name = token.tokenType.name;
  if (name === "NL") return newline(args);
  if (OPENERS.includes(name)) open.push(token);
  else if (CLOSERS.includes(name)) return { kept: true, error: discharge({ token, open }) };
  return { kept: true };
}

/**
 * A newline weighed against the brackets around it and the line beneath it.
 *
 * Inside `( )` and `[ ]` a real line break is dropped, which is the whole point
 * of the walk. A token that is only `;` is dropped as well, so the parse of
 * every file that already had one stays the parse it had, but it is refused out
 * loud first: whoever wrote it meant a separator and got silence.
 *
 * Which `;` it is decides the sentence, and getting that wrong made the message
 * worse than the silence: one written between two items wants a comma, but one
 * with nothing after it separates nothing, and a comma there is refused by an
 * argument list. `[1;]` becoming `[1,]` only ever compiled because a list
 * literal tolerates a trailing comma, which is luck rather than an answer.
 */
function newline(args: { token: Token; tokens: Token[]; index: number; open: Token[] }): Verdict {
  const { token, open } = args;
  const top = open.at(-1)?.tokenType.name;
  if (top === undefined || !DROPS_NEWLINES.includes(top)) {
    return { kept: !continuesAChain(args) };
  }
  if (token.image.includes("\n")) return { kept: false };
  return { kept: false, error: straySemicolon({ token, closes: closerAfter({ ...args, top }) }) };
}

/**
 * The bracket's own closer, when it is the very next thing after this newline.
 *
 * That is what says the `;` has nothing to separate: no item stands between it
 * and the end of the list. The closer travels back out because the sentence
 * names it, so a reader is shown the two characters the mistake is between.
 */
function closerAfter(args: { tokens: Token[]; index: number; top: string }): string | undefined {
  const { tokens } = args;
  let at = args.index;
  while (tokens[at]?.tokenType.name === "NL") at += 1;
  const wanted = CLOSERS[OPENERS.indexOf(args.top)];
  return tokens[at]?.tokenType.name === wanted ? wanted : undefined;
}

/**
 * A closer, which discharges the bracket on top only when it is that bracket's.
 *
 * Popping on any closer let a stray `}` cancel an open `(`, and with the `(`
 * gone so was the one report the rest of that file could still earn.
 */
function discharge(args: { token: Token; open: Token[] }): LexingError | undefined {
  const { token, open } = args;
  const top = open.at(-1);
  if (top && top.tokenType.name === OPENERS[CLOSERS.indexOf(token.tokenType.name)]) {
    open.pop();
    return undefined;
  }
  // With nothing open, nothing was being suppressed and nothing is missing: the
  // parser's own line about the closer is the better one, and a second report
  // beside it would only crowd the file with the same news twice.
  return top ? mismatchError({ closer: token, opener: top }) : undefined;
}

/**
 * Whether the line beneath this newline is the line above it, continued.
 *
 * A line that opens with `.` or `?.` reaches for a member of the line above,
 * which is how a long chain is broken up in every language that lets it be, and
 * the alternative here was brackets whose only job is to defeat this walk. Both
 * spellings, because both are a member read, and a reader who wraps a line on
 * the optional one has not written a different kind of thing.
 *
 * Three things bound it. A blank line does not continue anything, because a
 * blank line is how a reader separates two things. A `;` does not either, since
 * that is the writer ending the statement in as many characters. And the name
 * reached for has to be a plain `ID`: `Word` admits every keyword, so without
 * that last rule a stray `.` above a `return` would swallow the statement and
 * report itself at the end of the file instead of on the line that is wrong.
 *
 * A comment line between the two halves does continue the chain: a comment is a
 * note about the line under it, and above a `.filter` is exactly where one is
 * written. It costs nothing, because `COMMENT` is hidden and leaves the two
 * newlines around it standing in the stream, each of them one line break.
 */
function continuesAChain(args: { tokens: Token[]; index: number }): boolean {
  const { tokens } = args;
  let at = args.index;
  for (; tokens[at]?.tokenType.name === "NL"; at += 1) {
    if (!isAWrappedLine(tokens[at]?.image ?? "")) return false;
  }
  const reach = tokens[at]?.tokenType.name;
  return (reach === "." || reach === "?.") && tokens[at + 1]?.tokenType.name === "ID";
}

/** One line break and the blanks around it: not a blank line, and not a `;`. */
function isAWrappedLine(image: string): boolean {
  const first = image.indexOf("\n");
  return first !== -1 && first === image.lastIndexOf("\n") && !image.includes(";");
}

/**
 * A bracket nobody closed, reported where it was opened.
 *
 * What is carried is which character it was and where, in the shape the lexer
 * reports anything else it could not read. The words a reader sees are the
 * parse layer's, which is where every sentence about a file is written.
 */
function unclosedError(token: Token): LexingError {
  return {
    offset: token.startOffset,
    length: token.image.length,
    line: token.startLine ?? 1,
    column: token.startColumn ?? 1,
    message: `unclosed bracket: ->${token.image}<- at offset: ${token.startOffset}`,
  };
}

/**
 * A `;` written inside `( )` or `[ ]`, reported at the `;` itself.
 *
 * An `NL` token swallows the blanks on either side of what it matched, so the
 * character that is wrong sits somewhere inside the image rather than at its
 * start. Adding that shift to the column is only sound because this is reached
 * for an image with no line break in it, so the `;` is on the token's own line.
 *
 * `closes` is the bracket's closer when nothing stands between the two, which
 * is a different mistake wanting different words: nothing is missing there, so
 * the `;` goes rather than becomes a comma.
 */
function straySemicolon(args: { token: Token; closes?: string }): LexingError {
  const { token, closes } = args;
  const shift = token.image.indexOf(";");
  const offset = token.startOffset + shift;
  const dangling = `dangling separator: ->;<- before ->${closes}<-`;
  const said = closes ? dangling : "separator in brackets: ->;<-";
  return {
    offset,
    length: 1,
    line: token.startLine ?? 1,
    column: (token.startColumn ?? 1) + shift,
    message: `${said} at offset: ${offset}`,
  };
}

/**
 * A closer that is not the one the innermost open bracket is waiting for.
 *
 * All three characters travel in the message: the one that is wrong, the
 * bracket still standing open, and the one that would have closed it, so the
 * sentence can name what is missing without pairing the brackets up again.
 */
function mismatchError(args: { closer: Token; opener: Token }): LexingError {
  const { closer, opener } = args;
  const wanted = CLOSERS[OPENERS.indexOf(opener.tokenType.name)] ?? "";
  const said = `->${closer.image}<- against ->${opener.image}<- expected ->${wanted}<-`;
  return {
    offset: closer.startOffset,
    length: closer.image.length,
    line: closer.startLine ?? 1,
    column: closer.startColumn ?? 1,
    message: `mismatched bracket: ${said} at offset: ${closer.startOffset}`,
  };
}
