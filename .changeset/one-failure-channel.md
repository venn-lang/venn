---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
---

A failure keeps its code, its place and its help from where it was raised to
wherever it is read.

```venn
flow "payment declines" {
  step "charge" { fail "The card was declined." { code: "pay.declined", data: { last4: "4242" } } }
}
```

That program used to reach the reporters as
`{"kind":"log","data":{"level":"error","message":"The card was declined."}}`.
The code was gone, the data was gone, and the span the raiser had worked out was
gone with them. The pretty reporter then stamped `VN7001` on any error-level log,
so a timeout printed under the action family and an HTTP failure printed under
it too.

`EventData` had one envelope that could carry a `Problem`, `expect.failed`, so
everything that was not an assertion had nowhere structured to go. It has three
now, and which one a failure travels on says what kind of failure it was:
`expect.failed` is an assertion the program made and lost, `expect.soft_failed`
is one it asked to record and walk past, and `failure` is everything else. `log`
is what the program said, and its level no longer has `error`, which is how the
compiler proves nothing smuggles a failure through it.

**Whoever raises a failure reports it, where it happened.** The flow boundary
reports only what nobody claimed. That is one rule, and it settles four separate
complaints: a failure keeps the name of the step it happened in, `n` collected
branch failures count as `n`, a hook blowup stops arriving on the assertion
envelope, and `venn run` prints what `venn test` always printed.

```venn
flow "collect loses what it collected" {
  parallel { onError: "collect" } {
    step "billing" { fail "billing rejected the card" { code: "pay.declined" } }
    step "search"  { fail "search timed out talking to the index" }
  }
}
```

Two branches failed and the run reported one failure with the sentence "2
parallel branches failed.", because `AggregateError.errors` was read by nothing.
Both now arrive as problems with their own codes, each under its own step, and
`run.finished` agrees with the stream.

**A failing `expect` ends its step.** It did not, so after `expect res.status ==
200` failed the step went on clicking, publishing and running
`db.exec "TRUNCATE orders CASCADE"` against a state already known to be wrong.
`.soft` records and continues, which only means something now that the plain one
stops, and `.all` evaluates every check and reports each by name on one line
instead of reporting the whole block's source as a single title. The assertion is
thrown rather than reported at the raise site, so the innermost frame reports it
and `try { expect 1 == 2 } catch e { }` catches, binds `VN6001`, and leaves
nothing behind: no envelope, no count, no failure block on a run that exits 0.
That is how the specification spells an expected failure, and it could not work
before.

**Two steps can be open at once, so an event says which one it belongs to.**
`parallel` and `race` are kernel statements, so two `step.started` with no finish
between them are a shape the language emits by design, and the reporter held one
live step. Alpha's log printed under beta, alpha's failure was summarised with no
step name at all, and the durations were wrong. Every envelope now carries the
run of the step it came from, stamped by an emitter the step hands its body, so
attribution is structural rather than remembered by eleven emit sites. A step
inside a step, which is what a fragment is, keeps its own.

**A step says how it ended, even when it did not reach a verdict.** `break`,
`continue`, `return` and `exit` left `step.started` unbalanced, so a CI run showed
a non-zero exit and an empty failure list, and `exit` inside a step reached
`run.finished` with no `flow.finished` at all, which junit reported as
`<testsuite tests="0" failures="0"/>` for a run that executed steps. There is a
fifth status, `cancelled`, for a step or flow that was cut short rather than
judged.

**A frame's verdict comes from a tally scoped to that frame.** `engine.result` is
one counter shared by reference across every concurrent frame, and four places
read it differentially. Counting at the raise site put a sibling's failure inside
each of those reads: a step that did nothing wrong reported failed whenever a
concurrent step failed during its lifetime, and `@retry` judged an attempt by
what a sibling had done, re-ran a body that had already succeeded, and then
restored a snapshot that erased the sibling's failure. A tally composes towards
the root, so a sibling's failure is never in your chain. An attempt `@retry`
threw away reports nothing at all, which is also what stops a step that failed
twice and then passed from being drawn as a failure by every reporter on a run
that exits 0.

**`venn run` prints a problem the way everything else does.** It tested for a
`VennError` and a `ProblemError` is not one, so fifteen raise sites printed a
title and nothing else: no code to search for, no line in a three hundred line
script, and never the help that named the fix. `problemDetail` is now a terminal
layer over a presentation-free renderer in the kernel, beside the model, so the
terminal, the editor and junit say the same words about the same failure.

**junit carries the failure and reports steps.** It subscribed to `flow.finished`
alone and wrote the literal string `<failure/>`, so a well formed `VN6001` with a
title, a span and a structured diff still arrived empty. It writes one document
per invocation now rather than one per file, which is what made `venn test .`
produce output no XML parser would read, one `<testcase>` per step, and a
`<failure message type>` whose body is the same detail the terminal prints.
`--reporter dot` stops printing its one character per assertion for things that
were never assertions.

**The parser stops talking to itself.** `parse('flow "F" {\n  @timeout 50ms\n …')`
produced one problem whose title was 180 lines and 3573 characters, beginning
"Expecting: one of these possible Token sequences:", and the CLI printed all 181
of them while the editor published the same string. It now says
``A decorator takes its argument in brackets: write `@timeout(50ms)`.`` Token
names are translated (`ID` is a name, `':'` is a colon), and a property test over
the bad-source corpus holds every title to one line and a length.

The editor was the surface this reached last: Langium's own validator published
`parserErrors` verbatim with no code at all, so the whole essay went to the
margin. It runs the same front end the CLI does now, and
`same-as-the-cli.test.ts` covers the parse path it never covered.

Six more defects went with it. `REMOVED` was a plain object, so `flow "x"
constructor` reported ``VN5001 · function Object() { [native code] }`` and a real
syntax error was replaced by a lint one. `bracketTheArgument` advised on lines
that are not calls, offering ``Write `let (in= 1)`.`` for `let in = 1`.
`match x { -1 => … }` did not parse, because `LiteralValue` had no unary minus,
and the advice it drew instead was about bracketing on a line where no bracketing
helps. `Word` was documented as any keyword and lacked `loop`, `namespace`,
`null`, `true` and `false` while still listing the removed `while`, so `m.loop`
was a syntax error and `m.while` was not; a test now derives the set from the
generated grammar rather than trusting the sixth hand-written copy of it. A UTF-8
BOM, which is what Windows editors and PowerShell write by default, made a file
unparseable. And `pub const` inside a `namespace` was refused although the runtime
published it, while `pub fn` beside it worked.

**What a code means is now checked before it is believed.** Every Node error
carries a `.code`, so a plugin letting an `ENOENT` escape put it on the wire where
the model promises a `VNxxxx`. A code is taken only when it is shaped like ours,
and the one that was refused is kept in `note` so a maintainer can still find it.
A `fail` vouches for the code the program chose by carrying a whole problem, so
`e.code == "pay.declined"` still reads as the specification's flagship example
does. `detail.where` is accepted as a span only when it is one: a plugin using it
for prose used to replace the location the runtime had computed with a sentence.
