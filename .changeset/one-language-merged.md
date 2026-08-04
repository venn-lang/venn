---
"@venn-lang/core": patch
---

A name written in a block is the block's, and a closure keeps the one it had.

Giving a block inside a `fn` its own slot fixed direct reads and broke two things
next to them. `Frame.lookup` was changed to take the innermost slot with a name,
which is right for a closure written inside the shadowing block and wrong for one
written before it, and wrong in a way that regressed: where the block never ran,
the slot was never written and the closure read nothing at all.

It takes the outermost again, which is what it did before and is right for every
closure except the one written inside the block, and that case is #296: the
answer is to resolve a free name where the closure is built, not by searching
names when it is called.

And an assignment resolved through the body's flat list of names, so a write to a
name a block had shadowed landed on the binding outside it. It goes through
`slotOf` now, which is the lexical answer and the one the reads already used.
