import type { ParseResult } from "langium";
import type { Document } from "../generated/ast.js";
import { vennServices } from "../lang/index.js";
import type { Problem } from "../problem/index.js";
import { lexerErrorToProblem, parserErrorToProblem } from "./error-to-problem.js";
import { recordFile } from "./file-of.js";
import type { ParseOutput } from "./parse-output.types.js";
import { removedSyntax } from "./removed-syntax.js";
import { isUnclosedBracket } from "./said-error.js";
import { spacedMinus } from "./spaced-minus.js";

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
  const removed = removedSyntax({ text, uri });
  const cut = cutoff({ errors: result.lexerErrors, removed });
  const lexical = result.lexerErrors.map((error) => lexerErrorToProblem({ error, uri }));
  const syntactic = ownErrors({ result, uri, text, cut });
  // After the parse, since the grammar accepts what this refuses: a `-` written
  // apart from what follows it is an operator, and an argument holds no operator.
  const spaced = spacedMinus({ ast: result.value, text, uri });
  return [...lexical, ...removed, ...syntactic, ...spaced];
}

/**
 * Where the parser's own errors stop being about the line they are on.
 *
 * A statement the language no longer has cannot parse, and an unclosed `(`
 * takes the newlines out of everything after it, so past either one what the
 * parser reached is the wake of that one mistake, reported somewhere else.
 */
function cutoff(args: {
  errors: readonly { offset: number; message: string }[];
  removed: readonly Problem[];
}): number {
  const swallowed = args.errors.find((error) => isUnclosedBracket(error.message));
  const gone = args.removed[0]?.span.offset ?? Number.POSITIVE_INFINITY;
  return Math.min(gone, swallowed?.offset ?? Number.POSITIVE_INFINITY);
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
