---
"@venn-lang/core": minor
---

A `fn` body is pure all the way down.

```venn
fn shouts(n) {
  if n > 10 {
    print "inside a fn"     # refused now; the file checked clean before
  }
  return n
}
```

What a pure body may hold was listed once, at the top of the body, so a verb
written there was a parse error, which is right: a `fn` cannot reach the world.
The blocks those statements held were any block at all, so the same verb one
level in parsed. Nothing compiled it, the block read the answer as "stopped
here", and the function ended where it stood: it printed nothing and handed back
`null`, while `venn check` found no problems.

The blocks inside a body are made of the body's own statements now, so a verb is
refused wherever it is written, and the line that says so says that a `fn` is
pure and that a verb belongs in a `fragment` or at the top level of a file.

A `fn` that wants to refuse the input it was handed answers a value saying so.
Whether `fail` should stop being a verb and move into the kernel beside `return`
is a separate question, and this does not answer it.

Under all of it, a statement the body compiler has no case for stands still
rather than stopping the block, so no path through it can end a body with no
value to hand back.
