---
"@venn-lang/core": minor
---

Read a map literal inside `${…}`, down to the empty one.

A placeholder is parsed by wrapping its source in a minimal flow. The wrapper
was `expect`, which takes a block of checks as well as a subject, so `${{}}` and
`${ { } }` read as an empty block of checks and the hole came back holding
nothing: `Cannot read ${{}}, that is not an expression`. The wrapper is now
`return`, where nothing after it can open a block, so a map literal there is the
value it looks like at every size.

Nothing about the scanner changed: it already counted nesting, which is why
`${ { a: 1 }.a }` always worked and only the empty map failed.
