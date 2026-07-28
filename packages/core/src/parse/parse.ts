import type { ParseResult } from "langium";
import type { Document } from "../generated/ast.js";
import { vennServices } from "../lang/index.js";
import type { Problem } from "../problem/index.js";
import { lexerErrorToProblem, parserErrorToProblem } from "./error-to-problem.js";
import type { ParseOutput } from "./parse-output.types.js";

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
  return { ast: result.value, problems: collectProblems({ result, uri }) };
}

function collectProblems(args: { result: ParseResult<Document>; uri: string }): Problem[] {
  const { result, uri } = args;
  const lexical = result.lexerErrors.map((error) => lexerErrorToProblem({ error, uri }));
  const syntactic = result.parserErrors.map((error) => parserErrorToProblem({ error, uri }));
  return [...lexical, ...syntactic];
}
