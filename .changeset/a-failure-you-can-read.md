---
"@venn-lang/core": minor
"@venn-lang/prelude": minor
"@venn-lang/runtime": minor
---

A failure is a value a program can read.

```venn
fragment charge(order) {
  if order.amount > limit {
    fail "over the limit for this card" { code: "pay.limit", data: { over: order.amount - limit } }
  }
}

try {
  run charge(order)
} catch e {
  if e.code == "pay.limit" {
    print "try ${e.data.over} less"
  }
}
```

What `catch` bound was two fields built by a three-line function, bound as
`dynamic`. Everything else the failure knew, where it happened, what would help,
what the docs say, was rendered to a terminal and thrown away before the program
that caught it could see any of it, and `e.nowhere` passed `venn check` without a
word.

It is now the `error` type, which the language brings with it beside `regex` and
which is opaque for the same reason: `code`, `message`, `where`, `help`, `docs`
and `data` are the whole of it, and a member it does not have is refused where it
is written. Each is `null`, never absent, when the failure carried none.

The flow trace is not there. It holds spans of files the program may never have
opened, and handing those to a `catch` makes a failure a window into the whole
run rather than an account of one thing that went wrong.

`fail` now carries a code and a payload, so a library can raise a failure a
caller can tell apart. Without one it still raises `VN6002`.

Codes beginning `VN` belong to the language: every one is catalogued and
searchable, and a program raising `VN7010` to mean its own thing is a program
whose failures cannot be told from the language's. That is `VN3022`, reported
where the code is written, or where it is raised when the code was computed.
