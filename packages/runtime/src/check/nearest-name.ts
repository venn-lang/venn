/**
 * The name in a list that is nearly the one written.
 *
 * Shared by every check that reports a name nothing answers to, so "did you
 * mean" reads the same wherever it comes from.
 *
 * @param name What was written.
 * @param names What exists.
 * @returns The closest, or nothing when none is close enough to be the one
 * meant. Close enough scales with length: two letters wrong in a three-letter
 * name is a different name, and in a twelve-letter name it is a typo.
 */
export function nearestName(name: string, names: Iterable<string>): string | undefined {
  let best: string | undefined;
  let closest = Math.min(3, Math.floor(name.length / 2) + 1);
  for (const candidate of names) {
    const gap = distance(name, candidate);
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
