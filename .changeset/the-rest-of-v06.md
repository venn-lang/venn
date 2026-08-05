---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
---

The tail of v0.6: two shapes the specification documented and the runtime
ignored, one design question settled, and four defects the last two epics left
behind.

**`setup` and `teardown` run where they are written.** The grammar accepted them
inside a flow, the guide showed exactly that shape, and nothing executed them:

```venn
flow "doc example" {
  setup { print "before" }
  step "s" { print "the step" }
  teardown { print "after" }
}
```

printed only `the step`, with no error and no warning. Written at the top of a
file the same two blocks ran, so the difference was where they sat and nothing
said which the language meant. All four words now belong to the block they are
written in: `setup` before that block's statements, `teardown` after them
however they ended, `beforeEach` and `afterEach` around each step underneath,
stacked outermost first. A hook body never re-enters the hooks around it.

Two things fell out of writing it down. A `setup` inside a `race` used to settle
first and decide the race, and a `defer` in a loop body was skipped.

Cleanup now runs on an engine detached from the one that was called off, the way
`defer` already did. Without that a `teardown { db.close }` inside a step, a
group, a race branch or a `parallel` was stopped at its own first statement in
exactly the case cleanup exists for: cut short by a `@timeout`, a lost race or a
cancelled sibling. On the timeout path it also minted a second failure for one
timeout. And an `exit` in a block's `setup` now still runs that block's
`teardown`, which is what the file level always promised: what `setup` opened is
still open.

**A name read above the `let` that binds it is refused**, `VN2026`, rather than
answering two different things depending on how it ran:

```venn
fn made() {
  let see = fn () => later
  let later = "bound after"
  return see()
}
```

The compiled body and the interpreted one disagreed, and the same shape inside a
loop pass was wrong in both. Making it work would mean boxing every slot from a
body's first line; refusing it is one check, and a name read before it is bound
is almost always a mistake. Recursion is untouched: mutual recursion, a call to
a `fn` declared below, and a closure recursing on the `let` that binds it all
stay legal, and `Frame.lookup` survives for the last of those, documented as the
deliberate answer.

**An unbound name inside a decorated `fn` is reported again.** The check stood
back for the body of any decorated function, whatever the decorator was, because
a decorator may call `target.addParam(name)` and refusing that name would refuse
a correct program. It stood back too far and exempted every decorated function
from the check that catches typos. It now reads the decorator's body and excuses
only the names that decorator can be seen to add. A decorator written in
TypeScript adds nothing, so it excuses nothing; one whose body genuinely cannot
be reached still excuses everything, because refusing a working program is the
worse mistake.

**A compile problem reaches the reporters.** A file that failed the static check
still ran, and the problem went to stderr without entering the event stream, so
`venn test --reporter=junit` wrote a clean suite for a run that exited 1. A CI
job reading `results.xml`, which is what a junit reporter is for, saw green.
Every problem now travels the failure channel epic #287 built, and `run.finished`
is still the last envelope, which took holding the ending back until the
problems found before the run had been said.

`venn test` also gained the manifest phase `venn check` already had, so a stray
key in `venn.toml` is not exit 1 under one command and exit 0 under the other,
and it reports the key without cancelling the run.

**A BOM no longer moves line one.** Overwriting the mark with a space kept every
offset honest and left every column on line 1 one place to the right of where an
editor shows it. Taking the mark off at the Problem boundary instead fixes the
column and leaves the token stream alone, which matters more than it sounds: the
first attempt decremented the token columns, and because a CST range is built
from columns while its offset is built from bytes, renaming through the editor
on line 1 of a file with a mark rewrote the wrong five characters.

Colour is decided per stream. It was computed once at module load from
`process.stdout`, and problems are written to stderr, so a redirected stderr
collected escape codes.

**Three names that meant two things.** `LiteralType` was published from the
checker and from the generated AST, and the written clause won in silence, so
the grammar's node lost all three of its exports: `.$type` did not read,
`isLiteralType` narrowed to something with no name, and the descriptor was not a
value at all. The checker's is now `ExactType`, beside `PrimType`, `ListType` and
`RecordType`. Nothing catches that class and nothing can, since a written clause
beside a star is TypeScript's own remedy for the error it silences, which is why
the guard added last week is the thing that reports it.

**`@timeout` on a `parallel` is refused before the run.** It is a static fact
about where a decorator is written and it was only ever noticed at expansion
time, after both steps had run their full duration. `venn check` and `venn test`
now agree about it, and about `fail` inside a `deco` body, which check let
through and expansion refused. A test holds that agreement in both directions,
which the first version of it did not: it only asserted that everything check
refuses reaches the run, and a check that says nothing satisfies that.

**One example is a program rather than a test suite**, which is what the
milestone asked to close on: several modules, a folder with a face, a function
that fails and a caller that recovers.
