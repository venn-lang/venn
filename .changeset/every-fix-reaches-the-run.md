---
"@venn-lang/runtime": minor
---

Wire the three fixes that needed the runtime to reach them.

A decorator written in an imported file now takes effect, because the runner
hands `expand` the import graph it was already holding. Reaching for a name a
`deco` body cannot have is refused by `venn check`, at the name, rather than only
by the run that had already printed the wrong answer. And a `loop` whose state
advances by assignment ends: the name was re-set from the carried value at the
top of every pass, so the assignment was written and then overwritten, and the
loop ran for ever without reporting anything.

The three are in `@venn-lang/core` and were inert without these, which is why
they are one changeset.
