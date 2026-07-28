import { buildProblem, CODES } from "../codes/index.js";
import type { Problem, Span } from "../problem/index.js";

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

/** Map a parser error to VN1002. */
export function parserErrorToProblem(args: { error: RecognitionError; uri: string }): Problem {
  const t = args.error.token;
  const span: Span = {
    uri: args.uri,
    offset: t.startOffset,
    length: t.image?.length ?? 1,
    line: t.startLine ?? 1,
    column: t.startColumn ?? 1,
  };
  return buildProblem({ spec: CODES.VN1002_PARSE, span, title: args.error.message });
}
