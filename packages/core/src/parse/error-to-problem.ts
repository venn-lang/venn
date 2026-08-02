import { buildProblem, CODES } from "../codes/index.js";
import type { Problem, Span } from "../problem/index.js";
import { bracketTheArgument } from "./bracket-the-argument.js";
import { bracketTheTry } from "./bracket-the-try.js";
import { type Explained, removedKeyword } from "./removed-keyword.js";

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
  return buildProblem({ spec: CODES.VN1001_LEX, span, title: e.message });
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
  const t = args.error.token;
  const span: Span = {
    uri: args.uri,
    offset: at(t.startOffset, 0),
    length: t.image?.length ?? 1,
    line: at(t.startLine, 1),
    column: at(t.startColumn, 1),
  };
  const said = titleFor(args);
  return buildProblem({ spec: said.spec, span, title: said.title });
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
 * The parser's own words, unless this is an error the language can explain.
 *
 * Some of them are not really syntax errors at all: a word the language used to
 * have is a `VN5001`, wherever the parser happened to stop, so an explainer says
 * which code it is as well as what to write.
 */
function titleFor(args: { error: RecognitionError; text?: string }): Explained {
  const token = args.error.token.image;
  const removed = removedKeyword(token);
  if (removed) return removed;
  const text = args.text;
  const parsed = CODES.VN1002_PARSE;
  if (text === undefined) return { title: args.error.message, spec: parsed };
  const offset = args.error.token.startOffset;
  const explained =
    bracketTheArgument({ operator: token, text, offset }) ?? bracketTheTry({ text, offset });
  return { title: explained ?? args.error.message, spec: parsed };
}
