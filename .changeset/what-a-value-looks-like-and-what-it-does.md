---
"@venn-lang/core": minor
---

A value written into `${…}` now reads the way it is written in a program: a
list as `[1, 2]`, a map as `{ hits: 0, name: "ada" }` however deep it goes, a
moment as its ISO text. No Venn value can produce `[object Object]` any more,
and a list is no longer joined into `1,2`.

Moments also do arithmetic. `ended - began` is the duration between them,
`began + 2h` and `began - 2h` are moments, and two moments compare with each
other. Anything else involving a moment, times two, plus a plain number, is
still refused with VN3012 naming both sides.
