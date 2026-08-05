import { buildProblem, CODES, type Problem, type Span } from "@venn-lang/core";

/**
 * A name used in a file that never imported it, in the one place the words are
 * written.
 *
 * The words live here rather than at the three checks that report it, because a
 * help line each caller spells is a help line one caller spells wrong: a literal
 * ellipsis where the module path belongs. The path is the whole of what the
 * reader is missing, and the diagnostic is already holding it.
 *
 * It is a hint rather than a refusal because every run loads every plugin, so
 * the name resolves either way and refusing it would make the compiler
 * contradict itself. What is left is worth saying: the top of a file should be
 * the answer to where a name came from.
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
