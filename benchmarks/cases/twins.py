"""The Python twins of the benchmark cases.

Each mirrors its `.vn` file the way `src/cases/twins.ts` does: same algorithm,
same intermediate lists, same closures. Venn has no assignment, so these avoid
one too, except in `loop`, for the same reason the TypeScript twin needs it.

Run through `runner.py`, which does the warmup, the repetitions and the median.
"""

from functools import reduce


def make_range(n):
    """What `range(n)` returns in Venn: a real list, 0 … n-1."""
    return list(range(n))


def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)


def fib_case():
    return fib(25)


def reduce_sum():
    return reduce(lambda a, x: a + x, make_range(50_000), 0)


def branch_count():
    return reduce(lambda a, x: a + 1 if x % 2 == 0 else a, make_range(50_000), 0)


def pipeline():
    people = [{"id": i, "team": i % 7, "age": 20 + i % 50} for i in make_range(5_000)]
    seniors = sorted([p for p in people if p["age"] > 40], key=lambda p: p["age"])
    return len(seniors) + len(count_by(people, lambda p: p["team"]))


def count_by(items, key):
    counts = {}
    for item in items:
        at = key(item)
        counts[at] = counts.get(at, 0) + 1
    return counts


# The loop twin uses assignment, which Venn does not have. Without a store the
# body computes a value nobody reads, and the case would time an empty statement.
_sink = 0


def loop():
    global _sink
    xs = make_range(50_000)
    for x in xs:
        _sink = x * 2
    return len(xs)


def counter():
    total = 0
    while total < 50_000:
        total = total + 1
    return total


def records():
    rows = [{"id": i, "score": i % 13} for i in make_range(20_000)]
    return len([r for r in rows if r["score"] > 6])


def strings():
    return len([f"item-{i}-{i % 7}" for i in make_range(10_000)])


CASES = [
    ("fib(25)", fib_case),
    ("reduce 50k", reduce_sum),
    ("branch 50k", branch_count),
    ("pipeline 5k", pipeline),
    ("loop 50k", loop),
    ("counter 50k", counter),
    ("records 20k", records),
    ("strings 10k", strings),
]
