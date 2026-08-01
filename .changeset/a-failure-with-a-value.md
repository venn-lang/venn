---
"@venn-lang/core": minor
"@venn-lang/runtime": patch
"@venn-lang/lsp": minor
---

`try` can produce a value.

```venn
const port = try json.parse(raw).port else 8080
const why = try http.get(url) catch e => e.message
```

The block form recovers where steps run, so "try this, and if it fails use that"
could only be written by binding before the `try` and assigning inside it, and
inside a `fn` body it could not be written at all.

`else` gives the value to stand in with; `catch e =>` gives the same, with the
failure bound to a name. What it binds has a `message` and a `code`. The two
forms split on the same line as the rest of the language: `{ … }` runs steps,
`=>` gives a value.

Only a failure is caught. A `break`, a `return` or an `exit` is the program going
where it was told, and catching one would turn a loop's `break` into a fallback.

There is no bare `try` without `else` or `catch`: `try f() else null` says what it
does, and an attempt whose fallback nobody wrote is a failure nobody handled.

The failure a `catch` binds now carries the code it was raised with. Both forms
read it from one place, and the one they replace read it from the wrong field, so
every failure the compiler raised came back as `VN7000`.
