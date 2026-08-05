import type { Problem } from "@venn-lang/core";
import type { Diagnostics } from "./diagnostics.types.js";

/**
 * The one list `venn run`, `venn check` and `venn test` print.
 *
 * There were three: `venn check` de-duplicated its own walk in a private helper,
 * `venn run` and `venn test` de-duplicated nothing, and nothing anywhere put a
 * file's problems in the order a person reads them. So the same project gave a
 * different count under each command, and a mistake on line 21 arrived before
 * one on line 16.
 *
 * @returns A list that answers, once per command, with what has not been said.
 */
export function createDiagnostics(): Diagnostics {
  const said = new Set<string>();
  return { unsaid: (problems) => inReadingOrder(fresh(problems, said)) };
}

/**
 * Same code, same file, same character, same words: the same mistake, however
 * many passes or files arrived at it.
 *
 * The title is in the key because a code and a span are not enough on their own:
 * two checks may refuse the same character for different reasons, and both are
 * worth saying.
 */
function fresh(problems: readonly Problem[], said: Set<string>): Problem[] {
  return problems.filter((problem) => {
    const key = `${problem.code}:${problem.span.uri}:${problem.span.offset}:${problem.title}`;
    if (said.has(key)) return false;
    said.add(key);
    return true;
  });
}

/**
 * By file, then by where in the file: the order a person reads, which is the
 * order they fix in.
 *
 * Deliberately not by severity, which is what the analysis sorts by and what
 * these were printed in until now. An error further down a file arriving before
 * a hint at the top of it reads as though the file were two files, and the first
 * thing a person fixes is the first thing that is wrong, not the loudest.
 */
function inReadingOrder(problems: readonly Problem[]): Problem[] {
  return [...problems].sort(
    (one, other) => compare(one.span.uri, other.span.uri) || one.span.offset - other.span.offset,
  );
}

function compare(one: string, other: string): number {
  if (one === other) return 0;
  return one < other ? -1 : 1;
}
