---
"@venn-lang/core": minor
---

A block body can answer with a value or with nothing.

```venn
fn problemWith(row) {
  forEach part in parts() {
    if row.marks[part] == null {
      return "no ${part}"
    }
  }
  return null
}
```

The `return`s of a body were unified with each other, so the second was measured
against the type of the first and this read `VN3010 · expected string, found
null`. Declaring `-> string | null` did not help: the mismatch was raised
between the two ways out, before any annotation was consulted. The same function
written as one ternary was accepted and inferred the union, so the language was
pushing an author towards the less readable of two spellings for no reason they
could see.

The ways out now make a union, the way the two sides of a `try` do. Ways out
that agree stay the one type they are, rather than becoming a union of a thing
with itself.

An annotation still decides. `-> string` still refuses a body that may hand back
nothing, because a union is allowed through only when every member of it is:

```venn
fn give() -> string {
  return null              # VN3010 · expected string, found null
}
```
