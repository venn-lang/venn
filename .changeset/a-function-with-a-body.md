---
"@venn-lang/core": minor
"@venn-lang/lsp": minor
---

A function body can hold statements.

```venn
fn firstOver(xs: list<number>, limit: number) -> number | null {
  forEach x in xs {
    if x > limit {
      return x
    }
  }
  return null
}
```

It was bindings and one expression: no `if`, no early `return`, no loop. Every
branch had to be a ternary and every fold a `reduce`, and a function that wanted
to stop early could not.

A body holds `let`, assignment, `if`, `forEach`, `repeat`, `loop`, `break`,
`continue` and `return`. What it does **not** hold is a step, an `expect` or a
plugin verb, and that lives in the grammar of a body rather than in a rule to
remember: a `fn` is pure, so it decides, binds, loops and gives a value back.

The block still ends in the value it gives, so `{ let a = w * h` / `a }` means
what it always did, and `=> expr` is unchanged.

The body is still compiled, and still to slots and one frame. A statement is a
step over that frame rather than anything a scheduler runs, which is what keeps
a call as cheap as it was: measured against `main` with interleaved rounds, the
median moved 0.1%.
