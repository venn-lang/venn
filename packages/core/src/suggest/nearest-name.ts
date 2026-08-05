/**
 * The name in a list that is nearly the one written.
 *
 * Shared by every check that reports a name nothing answers to, so "did you
 * mean" reads the same wherever it comes from: unbound names, undeclared `env`
 * reads and unknown option keys all ask here.
 *
 * Two conditions, and a candidate has to pass both.
 *
 * How far a typo may stray is two letters at any length, and one more for every
 * three letters after that. The floor is what makes `tkn` reach `token`, the
 * everyday typo; the growth is why `authorizationheader` tolerates six while
 * `outdir` is not told it meant `outputdir` on the strength of rewriting half
 * of it. One number rather than three: the unbound-name check used to refuse
 * what the options check suggested, so one misspelling got a fix in the
 * terminal and silence in the editor.
 *
 * And the edits have to be fewer than half of the longer of the two names, so
 * what is offered is always more the same than different. A floor of two on its
 * own is the whole of a short name: `x` was told it meant `y`, `up` meant `id`,
 * `sum` meant `set` and `http.no` meant `http.on`, none of which is a typo of
 * the other, and a wrong guess at a lifecycle event replaced the list of all
 * six with one name. Single- and two-letter locals are ordinary in real flows.
 *
 * @param name What was written.
 * @param names What exists. Read once, so an iterator is fine.
 * @returns The closest, or nothing when none is close enough to be the one
 * meant. Ties go to the first, which is the order the caller offered them in.
 */
export function nearestName(name: string, names: Iterable<string>): string | undefined {
  let best: string | undefined;
  // One past the furthest that counts, so the comparison below keeps the first
  // of a tie rather than the last.
  let closest = Math.max(2, Math.floor(name.length / 3)) + 1;
  for (const candidate of names) {
    const gap = distance(name, candidate);
    if (gap * 2 >= Math.max(name.length, candidate.length)) continue;
    if (gap < closest) [best, closest] = [candidate, gap];
  }
  return best;
}

/**
 * Levenshtein distance between two names.
 *
 * One row rather than a matrix: names are short, and this runs only once a name
 * is already known to be wrong, which is the rare case by construction.
 */
function distance(left: string, right: string): number {
  let row = Array.from({ length: right.length + 1 }, (_, at) => at);
  for (let down = 1; down <= left.length; down += 1) {
    const next = [down];
    for (let across = 1; across <= right.length; across += 1) {
      const same = left[down - 1] === right[across - 1];
      next[across] = Math.min(
        (next[across - 1] as number) + 1,
        (row[across] as number) + 1,
        (row[across - 1] as number) + (same ? 0 : 1),
      );
    }
    row = next;
  }
  return row[right.length] as number;
}
