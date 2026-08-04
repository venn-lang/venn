---
"@venn-lang/core": patch
---

A write to a captured name a block never bound mints the cell instead of crashing.

`assign-step.ts`'s `intoSlot` wrote through a captured slot's cell without
checking there was one. Its twin in `frame.ts` has that guard and says why: a
cell that is not there yet is the block that never ran, and the slot takes one,
which is what the binding would have done had it been reached.

Reachable from source rather than in theory. A name a `match` arm or a
`try … catch` declares is in view for the whole body from its first line, while
its cell is minted only when the arm runs, so `let hold = try 1 catch e => fn () => e`
followed by `e = "cleared"` inside a `fn` was a host TypeError under a program
`venn check` called clean.
