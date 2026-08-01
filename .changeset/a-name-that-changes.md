---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

A name can be given a new value.

```venn
let total = 0
forEach price in prices {
  total = total + price
}
```

`x = 1` did not parse, anywhere. The only state that moved was a loop's own, so
every shape that was not a fold had to be bent into one, and the two constructs
that most want to hand a value outward, `try` and `if`, are statements.

`let` names what changes and `const` names what does not, which is the first
thing that has ever distinguished them. Writing to a `const` is refused where it
is written, with the word to use instead.

What `const` fixes is the name, not the value: `const cart = { … }` says `cart`
names one map for good, and the map is written into like anything else. Writing
a field or an item reaches the value itself, so everything holding that value
sees it.

**A function captures the binding, not a copy of it.** What it reads is what the
last assignment left. That falls out of how the kernel already works: a compiled
function addresses a cell, and an assignment writes through the same cell.

A parameter is a binding like any other, so it takes one too. What is written
has to fit what the name holds, by the same rule wherever it is written.
