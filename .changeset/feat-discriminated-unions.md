---
"@venn-lang/core": minor
---

Narrow a union by the field that tells its branches apart, and report the cases
a chain of `if`s leaves out.

Inside `if m.kind == "text"` the value is that one shape, so its fields are there
to be read and the other shapes' are not. `else`, `!=`, `&&` and `?:` all narrow
the same way, and the `else` of a chain carries whatever no branch took.

A chain that lists cases has to list them all: what was left out is VN3019, and a
branch testing a value the union never carries, or one an earlier branch already
took, is VN3020.

Two annotations start meaning what they say, because without them a union cannot
be built or received: a `fn` gives callers the return type it declared rather
than the shape its body happened to build, and a `fragment` parameter holds the
type written on it instead of `dynamic`.
