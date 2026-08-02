---
"@venn-lang/core": minor
"@venn-lang/http": patch
"@venn-lang/ws": patch
"@venn-lang/mqtt": patch
"@venn-lang/browser": patch
---

The body of a failure reads the way its title does.

`formatValue`, which renders each side of a diff, held its own copy of the
renderer: structures as compact JSON, and a map too awkward to print described in
prose as `a map with 12 fields`, which is a different shape rather than less of
the same one. Correcting the title without it would have left one message
disagreeing with itself.

Two things are still not taken verbatim, both on purpose. A key missing from one
side reads `absent` rather than `null`, a distinction only the diff walk can
produce and one the title never has occasion to make. And a string is quoted,
because a side of a comparison stands among values, which is the rule the
renderer itself applies one level in.

Four plugin matchers built their message with `String(...)`, which produced
`[object Object]` for anything that was not text. They use `show` now.
