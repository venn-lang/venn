---
"@venn-lang/core": minor
---

A `fn` written inside another reads the binding that was in view where it was
written, whichever block or loop pass that was.

```venn
fn made() {
  let out = []
  forEach n in [1, 2, 3] {
    let doubled = n * 2
    out = out.push(fn () => doubled)
  }
  return "${out[0]()} ${out[1]()} ${out[2]()}"
}
```

`2 4 6` at the top of a file and in a `fragment`, `6 6 6` inside a `fn`. A
closure in a compiled body asked for its free names by text when it was called,
and the answer was the outermost slot of that spelling in the whole body. Two
things follow from that and both were wrong. A closure written inside a block
that shadows a name read the binding outside the block, and one written in the
second of two same-named blocks read the first one's slot, which is `null` when
that block never ran. And a loop has one slot per binding, not one per pass, so
every closure a loop made read the last pass's value: for a `let` of the pass,
for the name a `forEach` gives its item, for a `repeat` index and for the state a
`loop` carries.

Which binding a `fn` meant is a fact about the place it sits, so it is settled
there. Each free name of the body gets a way to reach its cell: a slot of the
frame around it, a cell the enclosing body holds, or a free name of that body
too, which reaches a binding any number of frames out without walking a chain at
call time. A slot some closure captured holds a cell rather than the value, and
every binding that fills it mints a fresh one, so a pass keeps what its own
closures were made against while the loop goes on. Which slots those are is the
answer of a first pass over the body, so a loop that captures nothing allocates
nothing and costs what it did: a fifty thousand pass loop with no `fn` in it is
unchanged, and one that makes a closure holding a binding of the pass costs about
twelve nanoseconds a pass more.

Writing goes the same way. A closure that assigned to a name it did not bind
reached it by the same text search, so a read and a write of one name inside one
block could land on two different bindings.

`packages/cli/corpus/` gains the cases, and the three it had filed as open
against this now agree in all four placements.
