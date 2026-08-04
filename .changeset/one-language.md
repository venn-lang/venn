---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
---

A line means the same inside a `fn` as it does outside one.

```venn
fn total(rows) {
  let total = 0
  forEach row in rows { let total = row.n * 100 }
  return total
}
```

The scheduler walks a file's statements and `compile/` turns a `fn` body into
slot-addressed thunks, and the two disagreed. Written at the top of a file those
lines answer `0`, because the inner `total` is a binding of the loop. Written
inside a `fn` they answered `300`, because every block of a body was flattened
into one slot list and the inner `total` met the outer one there. Seven things
went the same way, and every one of them was silent: a wrong answer or a dropped
call, never a diagnostic, from a program `venn check` approved.

A block inside a `fn` has a scope now. Its bindings are still slots of the
function, because a call has one frame and not a chain of them, but a name is in
view for its own block and gone afterwards, and it is declared where it is
written rather than gathered up front. So a loop's binding dies with its loop, a
nested `let` shadows instead of overwriting, and a name is unreadable before its
own `let`, exactly as at the top of a file.

An assignment to a name the body does not bind reaches the binding it names, the
same one `runAssign` reaches. It used to be handed slot `-1`: a host `TypeError`
on a body with three locals, and a write nobody performed on a body with four.
`writeSlot` refuses a negative slot with a code rather than indexing with it, and
a member write into something that is not a place raises the `VN3021` the
scheduler raises.

A `let` carrying a verb inside a `fn` is refused, under the new `VN2024`, in the
sentence the bare form already gets. It parsed, checked clean and did nothing:
`let stop = fail "n must be positive"` compiled, ran, and reported success.

A pattern asks about shape and not only about literals. `{ user: { name } }`
matched a number, a string and a list alike and bound `name` to nothing, and the
arm still ran. The checker had the same root the other way round: an arm with no
literal read as the catch-all, so arm one settled every branch and every arm
after it was called unreachable, which made shape dispatch with a fallback
uncompilable. A `match` with no arms is refused; it answered `null` and satisfied
a declared `-> string`.

A verb called from inside another expression builds the input the statement form
builds. `crypto.hash("x", { algorithm: "sha512" })` meant sha512 bound with
`const` and sha256 inside a `print`, a misspelt option key was dropped in
silence, and the call emitted no events, so it was invisible to every reporter
and contributed no duration.

A `forEach` had four ways of running and they disagreed about what a pass binds;
which one you got depended on whether the body held a `defer` and on whether the
options asked for concurrency. They are one routine now, `loop` builds a scope
per pass like `repeat` always did, and a `break` under `{ concurrency: N }` ends
the loop rather than the one iteration that wrote it.

A `namespace` holds the four things that are names: a function, a binding, a
type and another namespace. Anything else is refused under the new `VN2025`,
naming the construct. A `flow` moved inside one to group it was not listed, not
run and not type checked, and `venn test` still exited 0.

Under all of it, `packages/cli/corpus/` holds the cases: one body per file, each
run at the top of a file, inside a `fn` declaration, inside a `fn` expression and
inside a `fragment`, asserting that the four agree and that each answer is the
one pinned. Three of them do not agree yet and say so in their own header: a
closure made in a compiled loop pass reaches its free name through the frame,
which has one slot per binding and not one per pass, so all three closures read
the last.
