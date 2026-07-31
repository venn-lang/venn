---
"@venn-lang/core": minor
---

Let a moment answer about itself.

```venn
const at = 2026-07-23T12:00:00Z

at.date          # "2026-07-23"
at.year          # 2026
at.plus(2h)      # a moment two hours later
at.until(other)  # how long between them, as a duration
at.isBefore(other)
```

`instant` was a kernel type and a literal, and a value of it answered nothing: no
parts, no arithmetic, no comparison. Printing one showed the shape holding it,
`{"kind":"instant","epochMs":…}`, which is the inside of the language leaking
out; it prints as the moment now.

Reading one as a map is gone with it: an instant is held as a shape with an
`epochMs` in it, so `at.kind` used to answer `"instant"`. What it publishes is
what it answers to, and nothing else.

Arithmetic uses the durations the language already has, so `at.plus(2h)` and
`at.until(other).hours` need nothing new to say how long. Everything here is read
in UTC: where somebody is standing is a question about them, not about the
moment, and that is what the `date` namespace will be for.
