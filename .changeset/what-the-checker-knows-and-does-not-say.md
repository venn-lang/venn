---
"@venn-lang/core": minor
---

Three things the type checker knew and did not act on.

Narrowing now survives a branch nobody falls out of, so a guard clause works:
`if status == null { return "no" }` leaves `status` a number for everything
written below it, whether the branch ends in `return`, `fail`, `break` or
`continue`. It also reaches the value of a `return`, which is read in the scope
the `return` stands in rather than in the body's own, so the flat way of writing
a function is now as good as the nested one.

A `fn`'s declared result reaches the literal its body builds. `fn rows() ->
list<Row>` is what the list is checked against, in an expression body and in a
block body alike, so rows whose fields differ row by row are allowed the way the
annotation says they are.

Comparing two lists, or two maps, with `==` or `!=` is reported as
`VN5006`. The operator asks whether the two are the same value, so such a line
is never true, and inside an `expect` it read as an assertion that held. The
help names `equals`, the matcher that compares contents.
