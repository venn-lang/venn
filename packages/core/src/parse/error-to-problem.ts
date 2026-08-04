import { buildProblem, CODES } from "../codes/index.js";
import type { Problem, Span } from "../problem/index.js";
import { bracketTheArgument } from "./bracket-the-argument.js";
import { bracketTheDeco } from "./bracket-the-deco.js";
import { bracketTheTry } from "./bracket-the-try.js";
import type { Explained } from "./explained.types.js";
import { saidLexerError, saidParserError } from "./said-error.js";
import { verbInAFn } from "./verb-in-a-fn.js";

/** The length, in characters, of the word a relocated span points at: `try`. */
const RELOCATED_LENGTH = 3;

/** Structural view of a Chevrotain lexer error (avoids importing chevrotain). */
interface LexerError {
  offset: number;
  line?: number;
  column?: number;
  length: number;
  message: string;
}

/** Structural view of a Chevrotain parser (recognition) error. */
interface RecognitionError {
  token: { startOffset: number; startLine?: number; startColumn?: number; image: string };
  message: string;
}

/** Map a lexer error to VN1001. */
export function lexerErrorToProblem(args: { error: LexerError; uri: string }): Problem {
  const e = args.error;
  const span: Span = {
    uri: args.uri,
    offset: e.offset,
    length: e.length,
    line: e.line ?? 1,
    column: e.column ?? 1,
  };
  return buildProblem({ spec: CODES.VN1001_LEX, span, title: saidLexerError(e.message) });
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
  const span = spanFor({ error: args.error, uri: args.uri, text: args.text, offset: said.offset });
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
  offset?: number;
}): Span {
  const { error, uri, text } = args;
  if (text === undefined) return tokenSpan(error, uri);
  if (args.offset !== undefined) {
    return placed({ uri, text, offset: args.offset, length: RELOCATED_LENGTH });
  }
  // A file the parser ran off the end of leaves `NaN` on the token, which used
  // to fall back to the top of the file, so "found the end of the file" read as
  // a claim about line one however far down the mistake actually was.
  if (Number.isFinite(error.token.startOffset)) return tokenSpan(error, uri);
  return placed({ uri, text, offset: text.length, length: 0 });
}

/** A span whose line and column are read from the source, since no token holds them. */
function placed(args: { uri: string; text: string; offset: number; length: number }): Span {
  const { line, column } = locate(args.text, args.offset);
  return { uri: args.uri, offset: args.offset, length: args.length, line, column };
}

/** A span over the token the parser stopped at. */
function tokenSpan(error: RecognitionError, uri: string): Span {
  const t = error.token;
  return {
    uri,
    offset: at(t.startOffset, 0),
    length: t.image?.length ?? 1,
    line: at(t.startLine, 1),
    column: at(t.startColumn, 1),
  };
}

/** The 1-based line and column of an offset, for a span an explainer relocated. */
function locate(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  return { line, column: offset - before.lastIndexOf("\n") };
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
 * Each explainer looks at the source rather than at the token, because recovery
 * lands where it can and not where the mistake is. The purity of a `fn` comes
 * first: inside one there are no arguments to bracket, so the two after it
 * would explain a mistake nobody made.
 */
function titleFor(args: { error: RecognitionError; text?: string }): Explained {
  const token = args.error.token.image;
  const said = saidParserError({ message: args.error.message, image: token });
  const text = args.text;
  if (text === undefined) return { title: said };
  const offset = args.error.token.startOffset;
  const imported = importSaid({ token, text, offset });
  if (imported) return { title: imported };
  const verb = verbInAFn({ text, offset });
  if (verb) return verb;
  const explained =
    bracketTheDeco({ token, text, offset }) ??
    bracketTheArgument({ operator: token, text, offset }) ??
    bracketTheTry({ text, offset });
  return { title: explained ?? said };
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
