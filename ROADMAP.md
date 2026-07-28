# Roadmap

The live version of this is the [Venn Roadmap project](https://github.com/orgs/venn-lang/projects/1),
where every item is a real issue and moves as work happens. This page is the
same plan in one page, for reading rather than navigating.

Venn is pre-1.0. Today it is a good language for describing tests and a
serviceable one for small programs. The distance to a general-purpose language
is honest work, and most of it is language design rather than implementation.

## What 1.0 means

The syntax stops moving, and a minor release never breaks a program that ran
before it. Nothing gets that promise until the specification and the
implementation agree on every point, verified rather than asserted.

## The one decision that blocks the rest

**You cannot write a counter.** There is no assignment, and `while` cannot
advance anything: the condition reads the enclosing scope while the body binds
in a child scope. The specification's own counting loop would not terminate.

Two answers, and they exclude each other:

- **Mutable local bindings.** Familiar to everyone. Costs the guarantee that a
  name means one value forever, which is what lets a read compile to an index
  and is much of why the interpreter is fast.
- **A functional accumulator.** A `loop` that carries a value, `fold` as a
  primitive, guaranteed tail calls. Keeps every optimisation and stays true to
  what Venn is. Asks more of a reader arriving from an imperative language.

This is [issue #2](https://github.com/venn-lang/venn/issues/2), and it is open
for discussion rather than decided.

## The path

| milestone | what it settles |
| :--- | :--- |
| [**v0.2 Foundations**](https://github.com/venn-lang/venn/milestone/1) | How a loop carries state. What may cross a file boundary (`pub type`, `pub const`). The string syntax the specification already promises. The four documented defects. Continuous integration and release. |
| [**v0.3 Type system**](https://github.com/venn-lang/venn/milestone/2) | Generics, which `TypeSpec` does not have at all. Discriminated unions and exhaustiveness. |
| [**v0.4 Ergonomics**](https://github.com/venn-lang/venn/milestone/3) | Destructuring and pattern matching. The grammar has neither. |
| [**v0.5 Standard library**](https://github.com/venn-lang/venn/milestone/4) | `math`, `date`, `json`, `path`. The prelude is six names today. |
| [**v0.6 Errors as values**](https://github.com/venn-lang/venn/milestone/5) | Recovering from failure inside a program. `try` is a testing construct. |
| [**v0.7 Tooling**](https://github.com/venn-lang/venn/milestone/6) | A debugger, a stable formatter, `venn doc`. |
| [**v0.8 Ecosystem**](https://github.com/venn-lang/venn/milestone/7) | Publishing plugins, resolving their versions, a registry. |
| [**v0.9 Stability**](https://github.com/venn-lang/venn/milestone/8) | Deprecation policy and `venn fix` migrations. |
| [**v1.0**](https://github.com/venn-lang/venn/milestone/9) | Syntax frozen, semver guaranteed. |

## Performance

Venn runs at roughly 65% of V8's speed and beats CPython, with no JIT and no
code generation. It is ahead of hand-written TypeScript on three of seven
benchmark workloads.

Closing the rest of the gap to V8 means compiling to JavaScript, which is a
deliberate future decision rather than an oversight. The interpreter has more
left in it first: field access still walks a chain of checks, and cold start is
twice Node's.

Performance work happens continuously rather than in a milestone, and
[a scheduled benchmark](https://github.com/venn-lang/venn/issues/26) exists so a
regression is noticed in days.

## What is deliberately not here

- **A package registry of our own.** npm interop works today, and inventing a
  registry before there are packages to host is the wrong order.
- **Self-hosting.** Writing Venn's compiler in Venn is a milestone for a
  language with a standard library, not for one without `math`.
- **Concurrency primitives beyond what testing needs.** `parallel`, `race` and
  bounded `forEach` exist because suites need them. Threads and channels wait
  for a reason to exist.

## Contributing to the roadmap

Ideas belong in [Discussions](https://github.com/venn-lang/venn/discussions)
before they become proposals. A change to the language itself goes through the
[language proposal template](https://github.com/venn-lang/venn/issues/new?template=3-language-proposal.yml),
which asks what it costs as well as what it gives.

The items most useful to pick up are the four documented defects in
[v0.2](https://github.com/venn-lang/venn/milestone/1): each is small, reproducible,
and already has a written diagnosis in
[`docs/known-gaps.md`](docs/known-gaps.md).
