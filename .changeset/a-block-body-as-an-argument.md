---
"@venn-lang/core": minor
---

A function with a block body can be written where an argument goes.

```venn
deco memo(target: Fn) {
  target.wrap(fn (call, args) {
    const key = "${args}"
    return call(args)
  })
}
```

The block held nothing but its result before, and one binding in it turned the
whole file into `VN1002`, pointing at the bracket that opened the call rather
than at anything to do with the body. A newline is the only thing that ends a
statement, and the lexer took every newline away between `(` and `)` so that a
call could span lines. A block written in there lost them with everything else,
so the statements ran into each other and there was no way to write two.

A `{ }` opened inside brackets now gives the newline back. The block reads the
same wherever it is written, which is what makes the decorator above the
ordinary way to write one instead of a shape that had to be bound to a name
first. It reaches a map and a `match` written across lines inside a call too:
those took a comma there and now take either.

The other side of it is that a brace means the same thing everywhere now, so an
expression broken over two lines inside one is refused inside a call as it
already was outside one. Bracket the expression, and it spans the lines again.
