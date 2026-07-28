# Algorithms

Venn away from testing: six small programs, no plugins, no network, nothing imported.
For anyone who wants to know what the language is like to think in before they write a
single `flow`.

| file | what it shows |
| --- | --- |
| [`01-fibonacci.vn`](01-fibonacci.vn) | recursion with `fn`, and `reduce` as the stand-in for a variable that changes |
| [`02-sorting.vn`](02-sorting.vn) | quicksort by hand, then `sort` with a comparator and `sortBy` with a key |
| [`03-binary-search.vn`](03-binary-search.vn) | bounds as parameters, `every` and `in` to prove the search right |
| [`04-word-frequency.vn`](04-word-frequency.vn) | `~=`, `countBy`, `groupBy`, and ordering a map's `entries` |
| [`05-primes.vn`](05-primes.vn) | a sieve out of `flatMap` and `keyBy`, then `pairwise` over the result |
| [`06-records.vn`](06-records.vn) | `type` declarations, `groupBy`, `sumBy`, `maxBy`, `partition`, a printed report |

Run them with:

```bash
venn run examples/algorithms/01-fibonacci.vn
```

These are programs, not tests: `venn run` executes the statements top to bottom. Each
one finishes in well under a second and prints as it goes. `venn check examples/algorithms/`
type-checks the lot in one pass.

Two things surprise people coming from elsewhere:

- **There is no assignment.** A name binds once, and loops rebind per iteration. Anything
  that would have been a mutable accumulator is the accumulator of a `reduce` (see
  `fibTable` in `01`) or a parameter of the next recursive call (see `search` in `03`).
- **A newline ends a statement.** A chain that runs over several lines has to sit inside
  brackets, which is why the long returns in `02` and `06` are wrapped in parentheses.

Next: [`../basics`](../basics) for the language proper, [`../testing`](../testing) for what
Venn is actually for.
