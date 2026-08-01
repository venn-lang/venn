---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

`??`, `||` and `&&` do what they promise.

```venn
const name: string = user.name ?? "anon"
const shown: string = user.name || "anon"
```

Three things, all found by running the operators rather than reading them.

**A left side that had not arrived broke all three.** A promise is neither
nothing nor false, so each decided against the promise itself: `slow() ?? 8080`
handed back the promise it was asked to replace, and `slow() && f()` ran `f`
however the left side turned out. They now wait, the way every other node does.

**The type kept the null the operator exists to remove.** `(string | null) ??
string` was `string | null`, and where the two sides disagreed the answer was
`dynamic`. `??` and `||` hand over the right side in exactly the case where the
left was nothing, so nothing cannot come out of either. `&&` is the other way
round, since the falsy left is what it gives back.

**`&&` and `||` were typed `bool`** while handing back an operand, so
`const name: string = user.name || "anon"` was refused although it runs.

Mixing `??` with `||` or `&&` without brackets is now refused as `VN1003`.
`a || b ?? c` and `a ?? b || c` answer differently and nothing in the line says
which reading is which, so the order is written:

```venn
const x = (a || b) ?? c
const y = a || (b ?? c)
```

A `try` where an argument goes now says what to write, instead of reporting that
a `{` was expected.
