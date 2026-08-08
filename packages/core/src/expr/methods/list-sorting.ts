import { isWaiting, whenAllReady } from "../pending.js";

/** A caller's comparator: a number now, or a value still on its way. */
type Ask = (a: unknown, b: unknown) => unknown;

/** Abandons the host sort, which needs its number the moment it asks. */
const WAITING = Symbol("venn.sort.waiting");

/** The one answer the abandoned sort was waiting on, and the pair that asked. */
type Held = { readonly a: unknown; readonly b: unknown; readonly answer: unknown };

/**
 * Sorted by a caller's comparator, which may answer something still arriving.
 *
 * The host sort is tried first and is what an ordinary comparator runs on, at
 * no cost to it. An answer that has not arrived cannot drive that sort, so it
 * abandons it, and the order is worked out instead from how many items each one
 * compares after: every pair asked at once, then counted. That is one
 * comparison per pair, so a comparator reaching for something slow pays the
 * square of the list; `sortBy` asks once per item and is what to reach for.
 */
export function sortedBy(list: readonly unknown[], ask: Ask): unknown {
  const kept: Held[] = [];
  try {
    return [...list].sort(askNow(ask, kept));
  } catch (thrown) {
    if (thrown !== WAITING) throw thrown;
    return whenAllReady(everyPair(list, ask, kept[0]), (answers) => byRank(list, answers));
  }
}

/** Compares now, or keeps the answer it cannot wait for and stops the sort. */
function askNow(ask: Ask, kept: Held[]): (a: unknown, b: unknown) => number {
  return (a, b) => {
    const answer = ask(a, b);
    if (!isWaiting(answer)) return Number(answer);
    kept.push({ a, b, answer });
    throw WAITING;
  };
}

/**
 * Every ordered pair's answer, reusing the one the abandoned sort is holding so
 * that comparison is neither asked twice nor dropped with nobody watching it.
 */
function everyPair(list: readonly unknown[], ask: Ask, held: Held | undefined): unknown[] {
  const size = list.length;
  const answers = new Array<unknown>(size * size);
  for (let a = 0; a < size; a += 1) {
    for (let b = 0; b < size; b += 1) {
      const same = held !== undefined && held.a === list[a] && held.b === list[b];
      answers[a * size + b] = a === b ? 0 : same ? held.answer : ask(list[a], list[b]);
    }
  }
  return answers;
}

/**
 * The order the settled answers describe: an item goes after as many items as
 * it compares greater than. Items that tie count the same and keep the order
 * they came in, which is the stability the host sort also gives.
 */
function byRank(list: readonly unknown[], answers: readonly unknown[]): unknown[] {
  const size = list.length;
  const rank = new Array<number>(size);
  for (let a = 0; a < size; a += 1) {
    let after = 0;
    for (let b = 0; b < size; b += 1) if (Number(answers[a * size + b]) > 0) after += 1;
    rank[a] = after;
  }
  const order = new Array<number>(size);
  for (let at = 0; at < size; at += 1) order[at] = at;
  order.sort((a, b) => (rank[a] as number) - (rank[b] as number) || a - b);
  return order.map((at) => list[at]);
}
