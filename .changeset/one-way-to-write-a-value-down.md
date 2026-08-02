---
"@venn-lang/core": minor
---

One definition of how a value is written out.

`print` and `str` went through a renderer of their own that answered with JSON,
so `print 300ms` gave `{"kind":"duration","ms":300}` while `"${300ms}"` two lines
later gave `300ms`, and every map printed as JSON while the same map interpolated
as itself. Whichever of the two a reader met first, the other one taught them the
language does not know its own mind. Both go through `displayValue` now, which is
`stringifyValue` with one rule changed.

That rule is `null`, and it differs on purpose. `print x` asked what `x` is and
deserves an answer, so it reads as `null`; an interpolation is a sentence with a
gap in it, and `add ${name}` with no name reads better as `add ` than as
`add null`.

`io.print` still writes JSON. It is a plugin, plugins do not depend on
`@venn-lang/core`, and copying the renderer into one is what produced this in the
first place.
