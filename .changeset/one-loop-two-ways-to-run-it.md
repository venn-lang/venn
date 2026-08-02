---
"@venn-lang/core": minor
---

A `loop` inside a `fn` now advances the state it carries when its body says
`continue next`. The value used to be evaluated and dropped, so the state never
moved, the loop never ended, and a hang is the one failure with nothing to read.
A plain `state = next` already worked there and still does, so both ways of
writing the loop advance it.

`repeat` and `forEach` inside a `fn` now refuse a bound they cannot use, with
the same `VN3016` and `VN3015` the scheduler raises at the top of a file, the
same sentence and a span on the offending expression. `repeat "3"` used to
coerce and run three times, and a `forEach` over anything but a list used to run
no passes and report nothing, which is a check that checked nothing dressed as
one that passed.
