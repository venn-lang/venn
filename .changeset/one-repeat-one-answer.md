---
"@venn-lang/core": minor
---

One `repeat`, one answer: the passes count from one wherever the loop is written.

```venn
fn passes() {
  let seen = ""
  repeat 3 as i {
    seen = "${seen}${i} "
  }
  return seen
}

print passes()   # "1 2 3 ", where it used to be "0 1 2 "
```

`as` names the pass, and a pass has been counted from one since the word existed:
the scheduler does it, `examples/basics/05-control-flow.vn` says so in as many
words. A `fn` body is not run by the scheduler, though. It is compiled to steps
over a frame, so a call stays cheap and a pure body has nothing to ask, and the
compiled `repeat` counted the offsets instead. The same word meant two things,
decided by where it was written.

Both answers read as plausible, which is what made it expensive. A rota, a retry
count and an index into a list are all wrong by exactly one and none of them look
wrong; the report that found it had its first meeting a week late.

Counting the passes also settles a fractional count the way the scheduler
already did: `repeat 2.5` runs twice, because the last pass there is room for is
the one at `2.5` rounded down.

**Breaking** for a `fn` that used the name as a position into a list. `repeat
xs.len as pass` now needs `pass - 1` to index `xs`, which is what the same loop
at the top of a file always needed.
