import { buildProblem, CODES } from "../codes/index.js";
import { shownColumn } from "../lang/index.js";
import type { Problem, Span } from "../problem/index.js";
import { spanAt } from "./at-an-offset.js";
import { bracketTheArgument } from "./bracket-the-argument.js";
import { bracketTheDeco } from "./bracket-the-deco.js";
import { bracketTheTry } from "./bracket-the-try.js";
import { commaInBrackets } from "./comma-in-brackets.js";
import type { Explained, ParserStop } from "./explained.types.js";
import { missingSeparator } from "./missing-separator.js";
import { optionsAteTheBody } from "./options-then-body.js";
import { saidLexerError, saidParserError } from "./said-error.js";

/** How much a relocated span underlines when the explainer named no width: the
 * word `try`, which is what the first of them ever pointed at. */
const RELOCATED_LENGTH = 3;

/** Structural view of a Chevrotain lexer error (avoids importing chevrotain). */
interface LexerError {
  offset: number;
  line?: number;
  column?: number;
  length: number;
  message: string;
}

/**
 * Structural view of a Chevrotain parser (recognition) error.
 *
 * `context` carries the rules the parser was inside, which is the only thing
 * that tells a missing statement separator from a missing map entry: the token
 * and the column are identical in both.
 */
interface RecognitionError {
  token: {
    startOffset: number;
    startLine?: number;
    startColumn?: number;
    image: string;
    tokenType?: { name: string };
  };
  message: string;
  context?: { ruleStack: string[] };
}

/**
 * Map a lexer error to VN1001.
 *
 * @param args The error, the uri for the span, and the source, which is what
 * says whether a byte-order mark is standing in the column the lexer counted.
 */
export function lexerErrorToProblem(args: {
  error: LexerError;
  uri: string;
  text?: string;
}): Problem {
  const { error, uri, text } = args;
  const line = error.line ?? 1;
  const column = shown({ text, line, column: error.column ?? 1 });
  const span: Span = { uri, offset: error.offset, length: error.length, line, column };
  return buildProblem({ spec: CODES.VN1001_LEX, span, title: saidLexerError(error.message) });
}

/**
 * Map a parser error to VN1002.
 *
 * @param args The error, the uri for the span, and the source, which one case
 * reads to say what to write instead of what was expected.
 */
export function parserErrorToProblem(args: {
  error: RecognitionError;
  uri: string;
  text?: string;
}): Problem {
  const said = titleFor(args);
  const span = spanFor({ ...args, said });
  return buildProblem({ spec: CODES.VN1002_PARSE, span, title: said.title });
}

/**
 * Where to point the problem: the word an explainer relocated it to, the end of
 * the file when that is what the parser ran out of, or the token it stopped at.
 */
function spanFor(args: {
  error: RecognitionError;
  uri: string;
  text?: string;
  said: Explained;
}): Span {
  const { error, uri, text, said } = args;
  if (text === undefined) return tokenSpan({ error, uri });
  if (said.offset !== undefined) {
    const length = said.length ?? RELOCATED_LENGTH;
    return spanAt({ text, uri, offset: said.offset, length });
  }
  // A file the parser ran off the end of leaves `NaN` on the token, which used
  // to fall back to the top of the file, so "found the end of the file" read as
  // a claim about line one however far down the mistake actually was.
  if (Number.isFinite(error.token.startOffset)) return tokenSpan({ error, uri, text });
  return spanAt({ text, uri, offset: text.length, length: 0 });
}

/** A span over the token the parser stopped at. */
function tokenSpan(args: { error: RecognitionError; uri: string; text?: string }): Span {
  const t = args.error.token;
  const line = at(t.startLine, 1);
  return {
    uri: args.uri,
    offset: at(t.startOffset, 0),
    length: t.image?.length ?? 1,
    line,
    column: shown({ text: args.text, line, column: at(t.startColumn, 1) }),
  };
}

/**
 * The column a reader sees, when the source is at hand to say so.
 *
 * A mark at the top of a file is a character the lexer counts and no editor
 * draws. Taken off here rather than off the token, because the token's columns
 * are what an editor's ranges are built from and those must keep counting it.
 */
function shown(args: { text?: string; line: number; column: number }): number {
  if (args.text === undefined) return args.column;
  return shownColumn({ text: args.text, line: args.line, column: args.column });
}

/**
 * A position, or where to point when there is none.
 *
 * The token for the end of the file carries `NaN` rather than nothing, so `??`
 * lets it through and the report reads `at file.vn:NaN:NaN`.
 */
function at(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

/**
 * What the language can say about this error, and the parser's own message put
 * into words when it can say nothing more.
 *
 * The order is the order the keys narrow in, and it is load bearing.
 *
 * The first three read the source rather than the token, because recovery lands
 * where it can and not where the mistake is. A verb written in a `fn` used to
 * come first here, reading the line the parser stopped on; the grammar parses
 * one now and the checker refuses it off the AST, which is right at every
 * layout rather than only where the verb began its line. `bracketTheDeco` comes
 * before the separator three because `@timeout print` is a decorator missing its
 * brackets and not a statement missing its newline, and only the line above the
 * token says which.
 *
 * The last three come last because they are keyed on the parser's own state,
 * which is the narrowest key there is: what it wanted, what it was inside, and
 * whether the token it stopped at could begin another item of the list it was
 * reading. Nothing they claim is a shape any of the four above recognises.
 * `commaInBrackets` runs before `missingSeparator` because a `[ … ]` pattern
 * offers a newline in the grammar that the lexer has already deleted, so only
 * the comma is true inside brackets.
 */
function titleFor(args: { error: RecognitionError; text?: string }): Explained {
  const token = args.error.token.image;
  const said = saidParserError({ message: args.error.message, image: token });
  const text = args.text;
  if (text === undefined) return { title: said };
  const offset = args.error.token.startOffset;
  const imported = importSaid({ token, text, offset });
  if (imported) return { title: imported };
  const worded = bracketTheDeco({ token, text, offset }) ?? readAsAValue({ token, text, offset });
  return worded ? { title: worded } : (stopped(args) ?? { title: said });
}

/** The two that read a line as one value written where the grammar wanted one. */
function readAsAValue(args: { token: string; text: string; offset: number }): string | undefined {
  const { token, text, offset } = args;
  return bracketTheArgument({ operator: token, text, offset }) ?? bracketTheTry({ text, offset });
}

/** The three keyed on what the parser wanted and what it was inside when it stopped. */
function stopped(args: { error: RecognitionError; text?: string }): Explained | undefined {
  const at: ParserStop = {
    message: args.error.message,
    offset: args.error.token.startOffset,
    ruleStack: args.error.context?.ruleStack ?? [],
    text: args.text ?? "",
    token: args.error.token.image,
    tokenType: args.error.token.tokenType?.name ?? "",
  };
  return optionsAteTheBody(at) ?? commaInBrackets(at) ?? missingSeparator(at);
}

/** What an `import` written below the first declaration is told, since the
 * parser only ever says it wanted the end of the file. */
const IMPORTS_FIRST = "Every `import` goes at the top of the file, above the first declaration.";

/** What an `import` the parser could not read at all is told: the shape of one. */
const IMPORT_SHAPE = 'An `import` names what it brings in: `import { one, two } from "./file.vn"`.';

/**
 * The `import` the parser stopped at, told as whichever mistake it is.
 *
 * One refused on line one is a badly written import, not a misplaced one, so
 * the header of the file is read before saying which of the two it was.
 */
function importSaid(args: { token: string; text: string; offset: number }): string | undefined {
  if (args.token !== "import") return undefined;
  const above = args.text.slice(0, args.offset).split("\n");
  return above.some(isADeclaration) ? IMPORTS_FIRST : IMPORT_SHAPE;
}

/** A line that is code of its own, so anything a file lists first goes above it. */
function isADeclaration(line: string): boolean {
  const written = line.trim();
  if (written === "" || written.startsWith("#")) return false;
  return !/^(module\b|(pub[ \t]+)?import\b)/.test(written);
}
