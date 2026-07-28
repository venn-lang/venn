/**
 * The TypeScript twins. Each mirrors its `.vn` file statement for statement:
 * same algorithm, same intermediate arrays, same closures.
 *
 * Venn has no assignment, so none of these use one. A `for` loop with a mutable
 * accumulator would be faster and more idiomatic TypeScript — and would measure
 * a different program, which is not what this compares.
 */

/** What `range(n)` returns in Venn: 0 … n-1. */
function range(n: number): number[] {
  return Array.from({ length: n }, (_unused, index) => index);
}

export function fib(n: number): number {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

export function reduceSum(): number {
  return range(50_000).reduce((a, x) => a + x, 0);
}

export function branchCount(): number {
  return range(50_000).reduce((a, x) => (x % 2 === 0 ? a + 1 : a), 0);
}

interface Person {
  id: number;
  team: number;
  age: number;
}

export function pipeline(): number {
  const people: Person[] = range(5000).map((i) => ({ id: i, team: i % 7, age: 20 + (i % 50) }));
  const seniors = people.filter((p) => p.age > 40).sort((a, b) => a.age - b.age);
  return seniors.length + countBy(people, (p) => p.team).size;
}

function countBy<T>(items: readonly T[], key: (item: T) => number): Map<number, number> {
  return items.reduce((counts, item) => {
    const at = key(item);
    return counts.set(at, (counts.get(at) ?? 0) + 1);
  }, new Map<number, number>());
}

export function strings(): number {
  return range(10_000).map((i) => `item-${i}-${i % 7}`).length;
}

/**
 * The loop twin uses an assignment, which Venn does not have.
 *
 * Without one V8 deletes the whole loop — the body computes a value nobody
 * reads — and the case would time an empty statement. The store is the smallest
 * thing that keeps both sides doing the same work per item.
 */
let sink = 0;

export function loop(): number {
  const xs = range(50_000);
  for (const x of xs) sink = x * 2;
  return xs.length + (sink > 0 ? 0 : 0);
}

export function records(): number {
  return range(20_000)
    .map((i) => ({ id: i, score: i % 13 }))
    .filter((r) => r.score > 6).length;
}
