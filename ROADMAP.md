# Roadmap

The live version of this is the [Venn Roadmap project](https://github.com/orgs/venn-lang/projects/1),
where every item is a real issue and moves as work happens. This page is the
same plan in one page, for reading rather than navigating.

Venn is pre-1.0, and it is a general-purpose language. Describing tests as
flows is what it does well first; it is not what it is. What is left before 1.0
is mostly language design rather than implementation, and the questions that
remain are named below rather than left implied.

## What 1.0 means

The syntax stops moving, and a minor release never breaks a program that ran
before it. Nothing gets that promise until the specification and the
implementation agree on every point, verified rather than asserted.

## Counting works

This page used to open by saying you could not write a counter, and that there
was no assignment and no loop that could advance anything. It has not been true
since `loop`, which binds a value and carries it through `continue`, and since
assignment landed beside it. Both of these run today:

```venn
let n = 0
forEach x in [1, 2, 3, 4, 5] { n = n + x }
print n
```

```venn
loop total = 0 {
  if total >= 6 { break }
  continue total + 2
}
print total
```

The first prints `15`, the second `6`.
[Issue #2](https://github.com/venn-lang/venn/issues/2), which this page called
the one decision blocking the rest, is closed. `while` is gone on purpose, and
writing one says so instead of hanging: `VN5001`, naming `loop`, `repeat` and
`forEach` and which of the three answers which question.

## What v0.6 settled

[v0.6 Programs, not just tests](https://github.com/venn-lang/venn/milestone/5)
closed with a hundred and twenty-two issues, and what it bought is the sentence
in its title: a program can now be written end to end, not only a suite. Six
epics carried it, and each is the same shape, one owner for one job:

| epic | what it settled |
| :--- | :--- |
| [one front end](https://github.com/venn-lang/venn/issues/284) | A pass added once reaches every command, so the editor and `venn check` stop disagreeing about what the language is. |
| [one language](https://github.com/venn-lang/venn/issues/285) | A line means the same inside a `fn` as outside it. |
| [one signal](https://github.com/venn-lang/venn/issues/286) | Everything that should stop actually stops. `@timeout`, `race`, `parallel` and `forEach` cancel through one scope composed with the one above it. |
| [one failure channel](https://github.com/venn-lang/venn/issues/287) | A problem keeps its code, its place and its help from where it was raised to where it is read. |
| [one owner for the value model](https://github.com/venn-lang/venn/issues/288) | One answer to what a value is and what it answers to, instead of a copy per package. |
| [guards that run](https://github.com/venn-lang/venn/issues/289) | The charter is enforced by CI rather than by memory. |

The four milestones before it are closed too, and their headline items are in
the language rather than on a list: generics and exhaustive unions, destructuring
and pattern matching with guards and alternatives, `math`, `date`, `json` and
`path`, and `try` as a value so a failure can be recovered from inside a program.

## What v0.7 is

[v0.7 Tooling](https://github.com/venn-lang/venn/milestone/6) is the current
milestone, and it is small on purpose:

- [**A debugger**](https://github.com/venn-lang/venn/issues/15). Breakpoints,
  stepping and a view of a frame, over the reverse channel the runner already
  speaks.
- **A stable formatter and `venn doc`.** `venn fmt` runs today; what it does not
  yet have is a promise that it will make the same choice tomorrow.

[Issue #311](https://github.com/venn-lang/venn/issues/311), a double-quoted key
inside a `${…}`, is answered rather than deferred: the restriction stays, because
a regular expression terminal cannot count nesting and the language already has
the spelling for the case, and what changed is that it now says so at the quote
instead of reporting an unbound name three tokens later.

## The open questions

These are language design, not implementation, which is why they are here and
not in a milestone. None has an obviously right answer.

- **How does a failure hand back both the value and the message?** Today it
  hands back one or the other. `try … else …` gives the value and drops the
  error, `json.tryParse` gives `null` with nothing said, `json.isValid` gives a
  verdict with nothing said, and the statement form keeps the error but cannot
  hand a value out of the block. A program that reads dirty input wants both and
  currently parses twice to get them. Reproduced in
  [`docs/known-gaps.md`](docs/known-gaps.md).
- **Should a name that copies read like one?** `xs.push(1)` returns a new list
  and changes nothing, which is right for a language where a name means one
  value, and reads exactly like the method that mutates in every language a
  reader arrives from. The defect underneath it is not the name: it is that a
  result could be thrown away in silence, and a warning on a discarded pure
  call closes that for `push` and for everything shaped like it. What is left is
  a name, and renaming a published verb costs every program that uses it.
- **Should there be a tuple?** `entries`, `zip` and `pairwise` hand back a pair,
  and there is no type for one, so a pair is modelled as a list of the two
  things it could hold. That is honest and it is lossy: reading `e[0]` answers
  a value the checker cannot name, so a mistake made by position is not caught
  while the same mistake made by name is. A tuple type closes it and is a
  language addition, not a fix, which is why it is a question and not a defect.
  It has one measured cost already. A list pattern that names more positions
  than the value holds is refused, but only when the value arrives, because how
  many items a list holds is not in its type: `forEach [a, b, c] in [[1, 2]]`
  passes `venn check` and is `VN3026` under `venn run`. A tuple makes that a
  check-time rule with no change to its sentence. The asymmetry beside it is not
  a second defect: a record pattern is checked statically and a list pattern at
  bind time, because the checker knows field names and cannot know a length.
- **Should the top level and a block follow one separator rule?** They do not.
  `const a = 1 const b = 2` is accepted at the top of a file and refused one
  brace deeper, because the document trails each declaration with an optional
  newline while a block requires one between statements. It was tried and put
  back during this work, and the reason it was put back is now evidence rather
  than a guess: both costs are written down in
  [`docs/known-gaps.md`](docs/known-gaps.md).
- **Should reading past the end of a list answer nothing, or refuse?** It answers
  nothing, and the type says so: `xs[5]` is the element type or `null`, so a read
  wants a guard or a stand-in. Most languages a reader arrives from chose the
  other way, and TypeScript makes the equivalent opt-in because it is noisy. The
  case for what is here: the runtime already answered `null`, so the type is
  honest rather than new; it caught two latent bugs in committed tests whose own
  documentation said they answer nothing; and a failing index would make the
  most common operation in the language fallible. The case against, beyond the
  guard at every read: the language now has two ways a thing can fail to produce
  a value and only one of them is reachable by `try`. `try (0).pow(-1) else 0`
  answers `0`, because that raises; `try xs[5] else 0` answers `null`, because
  nothing raised and the `else` never ran. The `else` reads as a guard and is
  dead code. Absence wants `??` or an `if`, refusal wants `try`, and nothing at
  the call site tells a reader which they are holding.

One question this page used to ask is now answered, and is recorded here because
the answer is what a reader will meet:

- **Does a fluent chain wrap across lines?** It does. A line beginning with a
  `.` continues the one above it; a blank line does not, a `;` does not, and a
  reserved word after the dot does not, because each of those is how a reader or
  a writer says the statement is over. All 147 `.vn` files in the repository
  were run through the rule and it fires in none of them, so nothing that
  parsed before parses differently.

## The path

| milestone | state | what it settles |
| :--- | :--- | :--- |
| [**v0.2 Foundations**](https://github.com/venn-lang/venn/milestone/1) | closed | How a loop carries state. What may cross a file boundary. The string syntax the specification promises. Continuous integration and release. |
| [**v0.3 Type system**](https://github.com/venn-lang/venn/milestone/2) | closed | Generics. Discriminated unions and exhaustiveness. `null` in a union, `regex` as a value, an inline shape in a `type`. |
| [**v0.4 Ergonomics**](https://github.com/venn-lang/venn/milestone/3) | closed | Destructuring and pattern matching, with guards, alternatives, a rest, and spread in a literal. |
| [**v0.5 Standard library**](https://github.com/venn-lang/venn/milestone/4) | closed | `math`, `date`, `json`, `path`, and an `io` that can see the terminal it writes to. |
| [**v0.6 Programs, not just tests**](https://github.com/venn-lang/venn/milestone/5) | closed | The six epics above. A program can be written end to end. |
| [**v0.7 Tooling**](https://github.com/venn-lang/venn/milestone/6) | current | A debugger, a stable formatter, `venn doc`. |
| [**v0.8 Ecosystem**](https://github.com/venn-lang/venn/milestone/7) | open | Publishing plugins, resolving their versions, a registry. |
| [**v0.9 Stability**](https://github.com/venn-lang/venn/milestone/8) | open | Deprecation policy and `venn fix` migrations. |
| [**v1.0**](https://github.com/venn-lang/venn/milestone/9) | open | Syntax frozen, semver guaranteed. |

## Performance

`pnpm --filter @venn-lang/benchmarks run bench` runs eight workloads written
three times each, in Venn, in TypeScript and in Python. Three runs on 2026-08-05,
on an Intel Core Ultra 9 185H under Windows 11 with Node 24.17.0, put Venn
between 40% and 48% of V8's speed and a little under CPython's, with no JIT and
no code generation. Hand-written TypeScript wins nearly every workload; which
one Venn takes changes between runs, which is the honest summary of a machine
this noisy. Read the ratios rather than the milliseconds.

This page used to say Venn ran at roughly 65% of V8's speed, beat CPython, and
was ahead of hand-written TypeScript on three of seven workloads. All three were
wrong, and none of them came from a run. They are recorded here rather than
quietly deleted, because a figure nobody measured is worse than a slow one.

Two numbers are steady enough to name. Cold start is about twice Node's, on the
same `fib(25)`. And a counting loop is the worst case by two orders of
magnitude: the `counter` workload is a few hundred times its TypeScript twin,
because the twin advances a machine word in place and Venn binds a fresh value
on every pass. Everything else is within about 3x.

Closing the rest of the gap to V8 means compiling to JavaScript, which is a
deliberate future decision rather than an oversight. `benchmarks/README.md`
holds the method, the profile behind each round of work already done, and the
two optimisations that were closed by measuring rather than by building.

Performance work happens continuously rather than in a milestone, and
[a scheduled benchmark](.github/workflows/benchmark.yml) runs nightly and on
every push that touches something which executes, so a regression is noticed in
days.

## What is deliberately not here

- **A package registry of our own.** A plugin is an npm package and resolves
  through `node_modules` and `venn.lock`. Inventing a registry before there are
  packages to host is the wrong order.
- **Self-hosting.** Writing Venn's compiler in Venn is a milestone for a
  language whose own tooling is finished, not for one whose debugger is still an
  open issue.
- **Concurrency primitives beyond what a program and a suite need.** `parallel`,
  `race` and bounded `forEach` exist because suites need them and programs use
  them. Threads and channels wait for a reason to exist.

## Contributing to the roadmap

Ideas belong in [Discussions](https://github.com/venn-lang/venn/discussions)
before they become proposals. A change to the language itself goes through the
[language proposal template](https://github.com/venn-lang/venn/issues/new?template=3-language-proposal.yml),
which asks what it costs as well as what it gives.

The items most useful to pick up are in
[`docs/known-gaps.md`](docs/known-gaps.md): each is a place the language, the
specification and the implementation disagree, each was found by writing real
code rather than by reading it, and each carries the program that shows it.
