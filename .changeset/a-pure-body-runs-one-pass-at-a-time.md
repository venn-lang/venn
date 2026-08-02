---
"@venn-lang/runtime": minor
---

`{ concurrency: n }` on a `forEach` inside a `fn` now says it cannot be honoured.

```venn
fn total(orders) {
  let sum = 0
  forEach one in orders { concurrency: 4 } {
    sum = sum + one.amount
  }
  return sum
}
```

A `fn` is pure and has no scheduler to ask for a pass out of order, so the
compiled loop above always ran its passes one at a time, exactly as `forEach
one in orders { }` without the option would. The option itself was read and
silently thrown away, so the difference between asking for four in flight and
getting one was something only a stopwatch could find.

`venn check` now refuses `concurrency` where it is written inside a `fn`, with
`VN5008`, saying that a pure body runs one pass at a time and that a
`fragment` is where concurrent work belongs. The same option at the top of a
file, or inside a `flow`'s `step`, is untouched: a `forEach` there still runs
through the scheduler, which can honour it.
