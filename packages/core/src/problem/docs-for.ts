/**
 * Every code the language catalogues, and the only shape that has a page.
 *
 * One owner, because both `Problem` factories ask it: `buildProblem` to derive
 * a link, and `problemOf` to decide whether a code a throw carried may be
 * reported at all. The rule used to be written out twice, one file apart.
 */
export const KERNEL_CODE = /^VN\d{4}$/;

/**
 * Where a reader goes to read more about a code.
 *
 * Derived here rather than written at each raise site, so the terminal, the
 * editor and a program's `catch` are handed the same URL whichever factory made
 * the problem. Runtime failures come through `problemOf` and compile-time ones
 * through `buildProblem`, and a program cannot tell which made its failure.
 *
 * A code a program chose for itself, `pay.declined`, is nowhere in the
 * catalogue, so linking one would send a reader to a page that does not exist.
 * Nothing is better than a dead link.
 *
 * @param code The code the problem is reported under.
 * @returns The page for it, or nothing when the code is not one of ours.
 */
export function docsFor(code: string): string | undefined {
  return KERNEL_CODE.test(code) ? `https://venn.dev/e/${code}` : undefined;
}
