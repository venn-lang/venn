---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/lsp": patch
---

Take a value apart where it is bound: `const { id, total } = order`.

A pattern goes wherever a name goes: a `let` or `const`, a `fn` or `fragment`
parameter, and the variable of a `forEach`. It mirrors the literal it reads,
`{ … }` for a map and `[ … ]` for a list, and a bare name inside one is the whole
of what is there, which is what lets the three nest in each other. A field can be
bound under another name with `{ id: reference }`.

A field the shape does not carry is reported where it is written rather than
arriving as null somewhere else, which is what the pattern gains from the
annotation. A `deco` is the exception: it takes its arguments by name, in the
order `@name(…)` fills them, so a pattern there has nothing to take apart and is
refused.
