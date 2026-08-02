---
"@venn-lang/sdk": minor
"@venn-lang/runtime": minor
"@venn-lang/io": minor
---

One renderer for every verb that writes a value.

`print` and `str` share a definition with `"${…}"`. `io.print` did not: the
plugin carried a renderer of its own that answered with JSON, so `print
{ hits: 0 }` gave `{ hits: 0 }` and `io.print { hits: 0 }` gave `{"hits":0}`,
while the verb's own documentation called itself the same verb under its full
name.

A plugin cannot reach the renderer, which lives in `@venn-lang/core`, and copying
it in is what produced two definitions the first time. So the runtime hands it
over instead. `ActionContext` gains `show(value)`, the runtime binds it to
`displayValue`, and `io.print`, `io.write`, `io.eprint` and the question
`io.ask` puts on the screen all go through it.

`show` is required rather than optional, and that is the point of it. An
optional member reads as an invitation to write a fallback, and the fallback is
how the second definition gets born again. The runtime builds the context in one
place, so there is one place to satisfy it.
