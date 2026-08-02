---
"@venn-lang/core": patch
---

A `try` block inside a `fn` names the right word, at the right line.

```venn
fn f(n) {
  try {
    return n * 2
  } catch e {
    return 0
  }
}
print f(3)
```

Read as syntax, this used to report `VN1002 · A fn is pure, so it cannot call
return`, pointing at the `return` inside the block. Neither half was true: a
pure body cannot hold a `try` statement, not `return`, and the statement it
refused was the `try` two lines above, not the one recovery happened to land
on.

A `fn` may still hold `try ... else ...`, the expression: the block form is
what is refused, and the language now says so, at the `try` itself, wherever
in the body it was written.
