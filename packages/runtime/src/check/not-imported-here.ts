import { buildProblem, CODES, type Problem, type Span } from "@venn-lang/core";

/**
 * A name used in a file that never imported it, in the one place the words are
 * written.
 *
 * Three checks said this and each spelled the help itself, so one of them
 * printed a literal ellipsis where the path belongs: the first hour of the
 * first program written in this language went on two package READMEs to learn
 * that the answer was `"venn/io"`, which the diagnostic was already holding.
 *
 * It is a hint rather than a refusal because every run loads every plugin, so
 * the name resolves either way and refusing it made the compiler contradict
 * itself. What is left is worth saying: the top of a file should be the answer
 * to where a name came from.
 *
 * @param args The name as this file writes it, the module path it comes from,
 * and where to put the squiggle.
 * @returns The hint, whose help line is an import that parses and runs.
 */
export function notImportedHere(args: { name: string; pkg: string; span: Span }): Problem {
  return buildProblem({
    spec: CODES.VN2007_NAMESPACE_NOT_IMPORTED,
    span: args.span,
    title: `"${args.name}" is not imported in this file.`,
    help: `Write \`import { ${args.name} } from "${args.pkg}"\`.`,
  });
}
