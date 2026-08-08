import { describe, expect, it } from "vitest";
import { INVOKE, isCallable } from "../invoke.js";
import { memberValue } from "../member-value.js";
import { type NativeFn, nativeFn } from "../native.types.js";

/** Read a member and call it, the way an expression would. */
function call(receiver: unknown, member: string, args: readonly unknown[] = []): unknown {
  const found = memberValue(receiver, member);
  return isCallable(found) ? INVOKE(found, args) : found;
}

/** A callback whose answer has not arrived, which is what reaching the world gives. */
function late(answer: (a: unknown, b: unknown) => unknown): NativeFn {
  return nativeFn((values) => Promise.resolve(answer(values[0], values[1])));
}

/** The same callback answering at once, because that case must stay what it was. */
function once(answer: (a: unknown, b: unknown) => unknown): NativeFn {
  return nativeFn((values) => answer(values[0], values[1]));
}

/**
 * An answer arriving after this many turns of the microtask queue. Ordering by
 * hops rather than by a clock keeps "this one answers first" a fact rather than
 * a guess about how loaded the machine is.
 */
function after(hops: number, answer: unknown): Promise<unknown> {
  let waited = Promise.resolve(answer);
  for (let at = 0; at < hops; at += 1) waited = waited.then((value) => value);
  return waited;
}

const tenfold = (n: unknown): number => (n as number) * 10;
const big = (n: unknown): boolean => (n as number) > 1;

/**
 * A built-in collection method running a callback that reaches for something
 * slow.
 *
 * Expressions compile to synchronous functions, so such a callback hands back
 * the promise it is running on rather than a value. Every method here read that
 * promise as the answer: `[1, 2].map(n => spawn(() => n * 10).wait)` printed
 * `[{}, {}]`, a filter kept every item because a promise is truthy, and a group
 * was filed under `[object Promise]`. Each verb is asked the same question
 * twice, once with an answer that has arrived and once with one that has not,
 * since making the second right must not cost the first anything.
 */
describe("a list method whose callback has not answered yet", () => {
  it("maps from the results rather than from the promises", async () => {
    expect(await call([1, 2], "map", [late(tenfold)])).toEqual([10, 20]);
    expect(call([1, 2], "map", [once(tenfold)])).toEqual([10, 20]);
  });

  it("filters on the verdicts once they are all in", async () => {
    expect(await call([1, 2, 3], "filter", [late(big)])).toEqual([2, 3]);
    expect(call([1, 2, 3], "filter", [once(big)])).toEqual([2, 3]);
  });

  /**
   * The matching item is not the first one asked about, and the last item
   * answers before it does. Neither decides: `find` answers the first match in
   * list order, which is what it means.
   */
  it("finds the first match in list order, not the first to answer", async () => {
    const staggered = nativeFn((values) => after(values[0] === 2 ? 8 : 0, values[0] !== 1));

    expect(await call([1, 2, 3], "find", [staggered])).toBe(2);
    expect(await call([1, 2, 3], "some", [staggered])).toBe(true);
    expect(call([1, 2, 3], "find", [once((n) => n !== 1)])).toBe(2);
  });

  it("answers some and every from every verdict", async () => {
    expect(await call([1, 2], "some", [late(big)])).toBe(true);
    expect(await call([1, 2], "every", [late(big)])).toBe(false);
    expect(call([1, 2], "some", [once(big)])).toBe(true);
    expect(call([1, 2], "every", [once(big)])).toBe(false);
  });

  /**
   * The accumulator is what the next step is handed, so gathering would hand
   * that step a promise, and a promise plus two is a string nobody asked for.
   */
  it("folds one step at a time, waiting for the accumulator", async () => {
    const carried: unknown[] = [];
    const step = nativeFn((values) => {
      carried.push(values[0]);
      return after(0, (values[0] as number) + (values[1] as number));
    });

    const plus = once((acc, n) => (acc as number) + (n as number));

    expect(await call([1, 2, 3], "reduce", [step, 0])).toBe(6);
    expect(carried).toEqual([0, 1, 3]);
    expect(call([1, 2, 3], "reduce", [plus, 0])).toBe(6);
  });

  it("runs every callback of forEach before answering null", async () => {
    const done: unknown[] = [];
    const record = nativeFn((values) => after(3, values[0]).then((n) => done.push(n)));
    const answer = call([1, 2, 3], "forEach", [record]);

    expect(done).toEqual([]);
    expect(await answer).toBeNull();
    expect(done).toHaveLength(3);
  });

  it("sorts by a comparator that answers late, leaving ties where they were", async () => {
    const rising = (a: unknown, b: unknown): number => (a as number) - (b as number);
    const tied = [{ id: "a" }, { id: "b" }];

    expect(await call([3, 1, 2], "sort", [late(rising)])).toEqual([1, 2, 3]);
    expect(await call(tied, "sort", [late(() => 0)])).toEqual(tied);
    expect(call([3, 1, 2], "sort", [once(rising)])).toEqual([1, 2, 3]);
  });

  /** The host sort is abandoned part way, so what it already asked is not lost. */
  it("sorts when only some of the comparisons answer at once", async () => {
    let asked = 0;
    const mixed = nativeFn((values) => {
      asked += 1;
      const order = (values[0] as number) - (values[1] as number);
      return asked === 1 ? order : after(0, order);
    });

    expect(await call([4, 2, 5, 1, 3], "sort", [mixed])).toEqual([1, 2, 3, 4, 5]);
  });

  /**
   * A prefix stops where it stops. Asking about the items past the end would
   * run the predicate where the caller never meant it to run, so this one waits
   * for each verdict in turn instead of asking for all of them.
   */
  it("cuts a run without asking about what is past its end", async () => {
    const seen: unknown[] = [];
    const small = nativeFn((values) => {
      seen.push(values[0]);
      return after(0, (values[0] as number) < 3);
    });

    expect(await call([1, 2, 3, 4], "takeWhile", [small])).toEqual([1, 2]);
    expect(seen).toEqual([1, 2, 3]);
    expect(await call([1, 2, 3, 4], "dropWhile", [small])).toEqual([3, 4]);
  });
});

describe("a list summarised by a callback that has not answered yet", () => {
  it("keeps the first item of each key", async () => {
    const parity = (n: unknown): number => (n as number) % 2;

    expect(await call([1, 2, 3, 4], "distinctBy", [late(parity)])).toEqual([1, 2]);
    expect(call([1, 2, 3, 4], "distinctBy", [once(parity)])).toEqual([1, 2]);
  });

  it("orders by a key that arrives late", async () => {
    const falling = (n: unknown): number => -(n as number);

    expect(await call([1, 3, 2], "sortBy", [late(falling)])).toEqual([3, 2, 1]);
    expect(call([1, 3, 2], "sortBy", [once(falling)])).toEqual([3, 2, 1]);
  });

  it("takes the smallest, the largest and the total from scores that arrive late", async () => {
    const itself = (n: unknown): unknown => n;

    expect(await call([3, 1, 2], "minBy", [late(itself)])).toBe(1);
    expect(await call([3, 1, 2], "maxBy", [late(itself)])).toBe(3);
    expect(await call([3, 1, 2], "sumBy", [late(itself)])).toBe(6);
    expect(call([3, 1, 2], "sumBy", [once(itself)])).toBe(6);
  });

  it("flattens results that arrive late", async () => {
    const twice = (n: unknown): unknown[] => [n, n];

    expect(await call([1, 2], "flatMap", [late(twice)])).toEqual([1, 1, 2, 2]);
    expect(call([1, 2], "flatMap", [once(twice)])).toEqual([1, 1, 2, 2]);
  });
});

describe("a list grouped by a key that has not arrived", () => {
  const team = (n: unknown): string => ((n as number) > 1 ? "big" : "small");

  it("groups, counts and indexes under the settled key", async () => {
    expect(await call([1, 2, 3], "groupBy", [late(team)])).toEqual({ small: [1], big: [2, 3] });
    expect(await call([1, 2, 3], "countBy", [late(team)])).toEqual({ small: 1, big: 2 });
    expect(await call([1, 2, 3], "keyBy", [late(team)])).toEqual({ small: 1, big: 3 });
    expect(call([1, 2, 3], "groupBy", [once(team)])).toEqual({ small: [1], big: [2, 3] });
  });

  it("partitions into kept and rejected once the verdicts are in", async () => {
    expect(await call([1, 2, 3], "partition", [late(big)])).toEqual([[2, 3], [1]]);
    expect(call([1, 2, 3], "partition", [once(big)])).toEqual([[2, 3], [1]]);
  });
});

describe("a map reshaped by a callback that has not answered yet", () => {
  const scores = { ada: 1, grace: 2 };

  it("rebuilds the values from the settled answers", async () => {
    expect(await call(scores, "mapValues", [late(tenfold)])).toEqual({ ada: 10, grace: 20 });
    expect(call(scores, "mapValues", [once(tenfold)])).toEqual({ ada: 10, grace: 20 });
  });

  /** The answer is the new name of the field, so answers are read by position. */
  it("renames the keys from the settled answers", async () => {
    const shout = (k: unknown): string => String(k).toUpperCase();

    expect(await call(scores, "mapKeys", [late(shout)])).toEqual({ ADA: 1, GRACE: 2 });
    expect(call(scores, "mapKeys", [once(shout)])).toEqual({ ADA: 1, GRACE: 2 });
  });

  it("keeps the fields whose verdict kept them", async () => {
    expect(await call(scores, "filterValues", [late(big)])).toEqual({ grace: 2 });
    expect(call(scores, "filterValues", [once(big)])).toEqual({ grace: 2 });
  });
});
