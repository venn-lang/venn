import type { ParseResult } from "langium";
import type { Document } from "../generated/ast.js";
import { vennServices } from "../lang/index.js";
import type { Problem } from "../problem/index.js";
import { lexerErrorToProblem, parserErrorToProblem } from "./error-to-problem.js";
import { recordFile } from "./file-of.js";
import { joinedInAnArgument } from "./joined-in-an-argument.js";
import { noSuchOperator } from "./no-such-operator.js";
import type { ParseOutput } from "./parse-output.types.js";
import { quoteInASlot } from "./quote-in-a-slot.js";
import { removedSyntax } from "./removed-syntax.js";
import { wakeStartsAt } from "./said-error.js";
import { spacedMinus } from "./spaced-minus.js";
import { verbInALambda } from "./verb-in-a-lambda.js";

/**
 * Parse `.vn` source into an AST plus VN1xxx problems. Synchronous and
 * filesystem-free (Chevrotain error recovery keeps a partial AST on failure).
 * It never throws: bad syntax comes back in `problems`.
 *
 * @param options.uri Source URI recorded on every span, for editors and reports.
 */
export function parse(text: string, options: { uri?: string } = {}): ParseOutput {
  const uri = options.uri ?? "memory://inline.vn";
  const result = vennServices().parser.LangiumParser.parse<Document>(text);
  // Recorded here because this is the one place a tree and its file meet. The
  // compiler asks for it later, where there is no document left to ask.
  recordFile(result.value, uri);
  return { ast: result.value, problems: parseProblems({ result, uri, text }) };
}

/**
 * The VN1xxx problems of a parse somebody else already ran.
 *
 * The language server never calls `parse`: Langium parses the document it holds
 * open and hands the result to its own validator. Exporting this is what lets
 * the editor publish the lines `venn check` prints, instead of Chevrotain's,
 * which name token types, byte offsets and the recovery strategy it chose.
 *
 * Three of the passes read the source rather than the parse: the grammar
 * accepts the spaced `-` that `spacedMinus` refuses, a string a quote ended
 * early is read past its end in the wrong mode, and a verb handed to a lambda
 * leaves the parser standing at the call with the rest of the file to complain
 * about. What the parser made of any of those is that one mistake's wake and
 * says nothing about the file.
 *
 * @param args The parse result, the uri to record on every span, and the source,
 * which the explainers read to say what to write instead of what was expected.
 * @returns Every problem the file's syntax earned, in reading order.
 */
export function parseProblems(args: {
  result: ParseResult<Document>;
  uri: string;
  text: string;
}): Problem[] {
  const { result, uri, text } = args;
  const read = sourceReads({ result, uri, text });
  const { wake, cut } = believedUntil({ result, text, read });
  const lexical = lexicalProblems({ errors: result.lexerErrors, uri, text, wake });
  const syntactic = ownErrors({ result, uri, text, cut });
  const spaced = spacedMinus({ ast: result.value, text, uri });
  return [...lexical, ...read.said, ...syntactic, ...spaced];
}

/** What the passes that read the source found, in the order a reader meets it. */
interface SourceReads {
  /** A statement the language no longer has, which the cut is measured from. */
  readonly removed: readonly Problem[];
  /** A string a quote ended inside its own `${…}`, whose wake starts at its line. */
  readonly quoted: readonly Problem[];
  /** A verb handed to a lambda, which the parser reports as the rest of the file. */
  readonly lambda: readonly Problem[];
  /** A spelling brought from another language, read off the places the parser
   * gave up: what it says about those lines is about the habit, not the line. */
  readonly habits: readonly Problem[];
  /** All four, flattened, so the caller does not have to know how many there are. */
  readonly said: readonly Problem[];
}

/**
 * Every pass that reads the source rather than the parse, run in one place.
 *
 * Gathered here because each one explains a mistake the parser then reported
 * again somewhere else in its own words, so what they find is also what decides
 * how much of the parser is worth believing. Four of us added one of these in a
 * day; the next is a field and a line, not another local in `parseProblems`.
 */
function sourceReads(args: {
  result: ParseResult<Document>;
  uri: string;
  text: string;
}): SourceReads {
  const { result, uri, text } = args;
  const scan = { text, uri, stopped: stoppedAt(result) };
  const removed = removedSyntax({ text, uri });
  const quoted = quoteInASlot({ text, uri });
  const lambda = verbInALambda({ text, uri, stopped: stoppedLines(result) });
  const habits = [...noSuchOperator(scan), ...joinedInAnArgument(scan)];
  const said = [...removed, ...quoted, ...lambda, ...habits];
  return { removed, quoted, lambda, habits, said };
}

/**
 * How far the parser is worth believing, and how far the lexer is.
 *
 * They differ, and only by one pass. A cut-short string is the single cause
 * that can also invalidate a LEXER error, because the rest of its line is read
 * in the wrong mode; the unclosed-bracket cut is itself made of a lexer error,
 * so cutting those there would delete the error the cut is made of.
 *
 * `wake` starts at the line and not at the quote, because the construct the
 * parser blames can have opened before it: a cut-short `step` title comes back
 * as a `flow` that should have been the end of the file, at column one of it.
 */
function believedUntil(args: { result: ParseResult<Document>; text: string; read: SourceReads }): {
  wake: number;
  cut: number;
} {
  const { read, text } = args;
  const at = read.quoted[0]?.span.offset;
  const wake = at === undefined ? Number.POSITIVE_INFINITY : text.lastIndexOf("\n", at) + 1;
  const gone = read.lambda[0]?.span.offset ?? Number.POSITIVE_INFINITY;
  const habit = read.habits[0]?.span.offset ?? Number.POSITIVE_INFINITY;
  const bracketed = cutoff({ errors: args.result.lexerErrors, removed: read.removed });
  return { wake, cut: Math.min(wake, gone, habit, bracketed) };
}

/**
 * The lines the parser stopped on, 1-based.
 *
 * A source scan that answers on a line the parser was happy with is a new
 * error on a working program, which is worse than the cascade it replaces.
 */
function stoppedLines(result: ParseResult<Document>): ReadonlySet<number> {
  return new Set(result.parserErrors.map((error) => error.token.startLine ?? 0));
}

/**
 * The offsets the parser stopped at.
 *
 * The same rule as {@link stoppedLines} and finer: a scan that reads the two
 * characters under a stopping place cannot mistake a `+=` written inside a
 * string for one written as an operator, because a string is one token and the
 * parser never stops in the middle of it.
 */
function stoppedAt(result: ParseResult<Document>): ReadonlySet<number> {
  const offsets = result.parserErrors.map((error) => error.token.startOffset);
  return new Set(offsets.filter((offset) => Number.isFinite(offset)));
}

/**
 * The lexer's own errors, minus whatever a cut-short string caused.
 *
 * Filtered here rather than in `cutoff`, because the other two cuts cannot
 * reach a lexer error: an unclosed bracket is one, raised at the very offset it
 * cuts from, so filtering there would delete the error the cut is made of.
 */
function lexicalProblems(args: {
  errors: ParseResult<Document>["lexerErrors"];
  uri: string;
  text: string;
  wake: number;
}): Problem[] {
  const { errors, uri, text, wake } = args;
  return errors
    .filter((error) => error.offset < wake)
    .map((error) => lexerErrorToProblem({ error, uri, text }));
}

/**
 * Where the parser's own errors stop being about the line they are on.
 *
 * A statement the language no longer has cannot parse, and a `(` left open
 * takes the newlines out of everything after it, so past either one what the
 * parser reached is the wake of that one mistake, reported somewhere else. A
 * closer that closes the wrong bracket leaves the `(` open too, which is why
 * both bracket faults are one question here rather than two.
 */
function cutoff(args: {
  errors: readonly { offset: number; message: string }[];
  removed: readonly Problem[];
}): number {
  const swallowed = args.errors.map(wakeStartsAt).filter((at) => at !== undefined);
  const gone = args.removed[0]?.span.offset ?? Number.POSITIVE_INFINITY;
  return Math.min(gone, ...swallowed);
}

/**
 * The parse errors that are about the line they are on.
 *
 * An `import` the parser refused takes the rest of the file with it: after one,
 * the grammar only ever wanted the end of the file, so every error past it says
 * the file should have ended before the very thing the first error just said
 * where to put. The token at the end of a file carries `NaN` for an offset,
 * which compares false against everything, so it drops out with the rest of
 * the wake.
 */
function ownErrors(args: {
  result: ParseResult<Document>;
  uri: string;
  text: string;
  cut: number;
}): Problem[] {
  const { result, uri, text, cut } = args;
  const own = result.parserErrors.filter(
    (error) => cut === Number.POSITIVE_INFINITY || error.token.startOffset < cut,
  );
  const wake = own.findIndex((error) => error.token.image === "import");
  const said = wake === -1 ? own : own.slice(0, wake + 1);
  return said.map((error) => parserErrorToProblem({ error, uri, text }));
}
