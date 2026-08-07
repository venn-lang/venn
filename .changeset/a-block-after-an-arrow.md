---
"@venn-lang/core": minor
---

An arrow can carry a block, so a callback with two lines in it has a spelling.

```venn
const rotulos = notas.map(n => {
  const media = n.soma / n.total
  media > 7 ? "aprovado" : "reprovado"
})
```

```
VN1002 · Expected the end of the file here, found an opening bracket.
```

The block existed and the arrow existed; they did not combine. Writing it meant
falling back to `fn (n) { … }` mid-expression, which is the long spelling of the
thing the short spelling was for.

`ArrowBody` was one expression by design, and the design had a reason: `{ … }`
after `=>` was already a map literal, which is how twenty-five places in this
repo are written and how the nicest of them read.

```venn
graded.map((one) => {
  student: one.who,
  average: (one.average ?? 0).toFixed(1),
  grade: one.grade
})
```

JavaScript made the other trade, and every arrow returning an object pays
`=> ({ … })` for it forever. Venn keeps both, because the two are told apart at
the token after `{` and always can be: a map entry is `key: value` or
`...spread`, and no statement starts that way. So `n => { total: 1 }` is the map
it looks like, and a block is the block it looks like. The grammar generator
reports no ambiguity, and the eighty-four recorded examples are untouched.

One thing moved rather than broke. `rows.forEach(r => { print r })` used to earn
`VN5010`, whose sentence is "a lambda body is one value", and that stopped being
true. The line now parses, and the verb inside it is refused one stage later by
the rule that actually applies: `VN2024`, a `fn` is pure. The parse-stage
recovery reads only lines the parser stopped on, so it stays out of a file that
works.
