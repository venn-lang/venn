---
"@venn-lang/core": minor
---

A list literal reads the element type it was declared with.

```venn
const rows: list<map<number>> = [{ x: 1, y: 2 }, { x: 3 }]   # VN3010, until now
```

Both items are a `map<number>`, which is what the annotation says the elements
are. What the checker compared them against was each other: a list made one type
for its items and unified every one of them with it, so the first item became the
rule and the annotation arrived at the binding, long after the list had a type
built without it. A list of records whose fields differ row by row is the
ordinary shape of configuration and of test data, and the way out was to build
the list from something the checker could not see through, which is the opposite
of what an annotation is for.

The declared element type is now handed down before the items are read, so each
one is checked against what the author wrote rather than against its neighbour,
and an item that does not fit is reported where it is written:

```venn
const xs: list<number> = [1, "two", 3]   # VN3010 at "two", and only there
```

It reaches wherever the type is already known: a binding, a field of a shape a
binding declared, an argument whose parameter is annotated, a decorator's
argument, and lists inside any of those.

With no annotation nothing changes. The first item is still all there is to go
on, and `[1, "a"]` is still one mistake rather than two.
