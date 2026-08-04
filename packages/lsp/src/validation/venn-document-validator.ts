import { type Document, type Problem, parseProblems } from "@venn-lang/core";
import {
  DefaultDocumentValidator,
  type LangiumDocument,
  type ParseResult,
  toDiagnosticSeverity,
  type ValidationOptions,
} from "langium";
import { CancellationToken, type Diagnostic } from "vscode-languageserver";
import { saidProblem, spanRange } from "./said-problem.js";

/**
 * The editor's diagnostics for a file the parser refused.
 *
 * Langium publishes Chevrotain's own messages verbatim, and Chevrotain writes
 * for whoever wrote the grammar: it names token types, byte offsets and the
 * recovery strategy it chose, one of its messages runs to 180 lines, and none
 * of them carries a VN code. `parse` has said all of that as one line in the
 * product's voice since issue #282; this is how the editor gets the same line,
 * from the same call, rather than a second answer of its own.
 */
export class VennDocumentValidator extends DefaultDocumentValidator {
  /**
   * Every problem this document has, parse errors first and alone.
   *
   * `venn check` stops at a parse error too, and for the same reason: the
   * semantic passes read the half a tree recovery managed to build, so what
   * they find is the wake of the syntax and not a second thing to fix.
   */
  override async validateDocument(
    document: LangiumDocument,
    options: ValidationOptions = {},
    cancelToken: CancellationToken = CancellationToken.None,
  ): Promise<Diagnostic[]> {
    const refused = this.refusals(document);
    // Drawn once, on the pass that runs `built-in`, the category a parse error
    // belongs to. A builder that asks for the categories in two goes appends the
    // second answer to the first, and every syntax error would be drawn twice.
    if (refused.length > 0) return this.parseCategory(options) ? refused : [];
    return super.validateDocument(document, options, cancelToken);
  }

  /** Whether this pass is the one the parser's and the lexer's errors belong to. */
  protected parseCategory(options: ValidationOptions): boolean {
    return !options.categories || options.categories.includes("built-in");
  }

  /** What the shared front end says about this document's syntax. */
  protected refusals(document: LangiumDocument): Diagnostic[] {
    const result = document.parseResult as ParseResult<Document>;
    const text = document.textDocument.getText();
    const problems = parseProblems({ result, uri: document.uri.toString(), text });
    return problems.map((problem) => this.published(problem, document));
  }

  /** One problem as the protocol carries it, with the code the catalogue gave it. */
  protected published(problem: Problem, document: LangiumDocument): Diagnostic {
    return {
      severity: toDiagnosticSeverity(problem.severity),
      range: spanRange(problem.span, document),
      message: saidProblem(problem),
      code: problem.code,
      source: this.getSource(),
    };
  }
}
