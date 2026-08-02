---
"@venn-lang/core": patch
---

The specification describes the module system the language has.

§10 said `use`, described a default import that is refused, and left out most of
what a reader has to know: what a module is, how a specifier resolves, what
`pub import` does, what happens to a name bound twice, and why a cycle is
refused rather than ordered.

It now says all of it, in the order a person reads them, and every rule has an
example under `examples/` that checks clean.

`docs/known-gaps.md` held seven entries and every one of them said "Closed",
which makes a list of gaps into a changelog. It records that the list is empty,
with where each answer went, and says plainly that empty is a statement about
what has been found rather than a promise.

The README claimed 1292 tests across 213 files. There are 2452 across 308.
