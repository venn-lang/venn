---
"@venn-lang/core": minor
"@venn-lang/runtime": patch
---

Pour a list into a list and a map into a map, with the same `...` a pattern uses.

```venn
const ys = [0, ...xs, 5]
const c = { ...defaults, timeout: 5s }
```

It is the other side of `...` in a pattern: there it keeps what was left, here it
pours what is there into what is being written. The last writer of a key wins, so
`{ ...defaults, timeout: 5s }` reads the way it looks.

The type follows. A list stays a list of one thing, a map ends up with the fields
of both, and pouring in something whose shape nobody knows leaves the whole
literal unknown, since any field could be the one it overwrote.

`a.merge(b)` and `a.mergeDeep(b)` answer with a type now rather than with
`dynamic`, worked out by the same pouring, so the two spellings agree. The
difference between them is visible at last: a shallow merge replaces a nested map
and a deep one goes into it.

`xs.push(1, 2)` stops being refused. The run always appended every argument, and
the signature said one, so the checker was refusing what the language accepts. A
verb that takes any number of one thing now says which thing, so `range(1, "a")`
is refused for the same reason `range("a")` is.
