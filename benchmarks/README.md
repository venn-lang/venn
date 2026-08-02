# Benchmarks: Venn vs TypeScript

```bash
pnpm bench
```

Seven workloads, each written twice: once in Venn, once in TypeScript. The
question is not *which language is faster*, Venn is a tree-walking interpreter
written in TypeScript, so V8 wins by construction. The question is **by how
much, and where**, because the answer differs by two orders of magnitude
between workloads.

---

## Method

- **Same algorithm, not just the same answer.** Venn has no assignment, so the
  TypeScript twins do not use one either. A `for` loop with a mutable
  accumulator would be faster and more idiomatic TypeScript, and would measure
  a different program.
- **The answers are checked.** Every case compares what Venn printed against
  the twin's value. A row marked `✗` means they disagreed and its numbers mean
  nothing.
- **Both sides run in one process, in one pass**, so they see the same machine.
- **Warmup, then repetitions, reported as the median.** V8 reaches its real
  speed only after a few passes; timing a cold run would flatter the
  interpreter. The median ignores a stray GC pause.
- **Parsing, type-checking and plugin registry are outside the timed region.**
  They happen once, as a real process does them once, compile time is reported
  separately. Langium builds its lexer on first use (~60 ms per process), so
  the harness warms it before measuring anything.
- **`range(n)` is native on both sides.** In `reduce`, `branch` and `records`,
  part of the TypeScript time is building that array, work Venn does natively
  too. Those ratios therefore *understate* the interpreter's overhead, enough
  that Venn edges out the twin on `reduce`.
- **One twin does use assignment: `loop`.** Without a store V8 deletes the whole
  loop, since the body computes a value nobody reads, and the case would time an
  empty statement. It is noted here because it is the one place the two programs
  differ.

Cold start is measured separately, by spawning whole processes: `node fib.ts`
against `venn run fib.vn`.

---

## Results

Node 24.17.0 · Intel Core Ultra 9 185H · Windows 11. Medians.

| case | stresses | TS (ms) | Venn (ms) | TS is | Venn speed | compile (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| fib(25) | function calls, recursion | 0.59 | 12.4 | 20.9× | 4.8% | 5.7 |
| reduce 50k | one closure call per element | 1.95 | 2.2 | 1.1× | 90.5% | 2.9 |
| branch 50k | conditional + arithmetic per element | 1.98 | 3.9 | 2.0× | 50.3% | 3.9 |
| pipeline 5k | filter / sort / group via native methods | 0.63 | 1.6 | 2.5× | 39.6% | 8.2 |
| loop 50k | forEach: a statement executed per item | 2.23 | 4.2 | 1.9× | 53.6% | 2.0 |
| records 20k | building maps, reading fields | 1.17 | 4.3 | 3.7× | 26.9% | 2.8 |
| strings 10k | string interpolation (20k placeholders) | 0.76 | 1.2 | 1.6× | 63.8% | 3.3 |

**Geometric mean: 2.8×: Venn runs at about 36% of V8's speed.** Every workload
but one is now within 4×; `fib` is the exception and the section below says why.

Run-to-run variance on this machine is roughly ±20%, and it shows: compare the
**ratio** columns rather than the absolute milliseconds, since the TypeScript
side drifts with the machine and divides the drift out.

Cold start, end to end, same `fib(25)`:

| | wall clock |
| --- | ---: |
| `node fib.ts` | 93 ms |
| `venn run fib.vn` | 180 ms |

### What each round bought

The first run of this suite measured a geometric mean of **27.9×**, with string
interpolation at **1501×**. Two rounds of profile-led changes since, none of
which altered semantics:

| | first run | level 0 | level 1 | level 2 | statements |
| --- | ---: | ---: | ---: | ---: | ---: |
| fib(25) | 134× | 102× | 70× | 21× | **21×** |
| branch 50k | 9.4× | 6.5× | 5.6× | 2.1× | **2.0×** |
| pipeline 5k | 8.6× | 7.2× | 5.4× | 3.6× | **2.5×** |
| records 20k | 7.4× | 5.9× | 4.9× | 3.0× | **3.7×** |
| reduce 50k | 3.5× | 3.5× | 2.9× | 1.2× | **1.1×** |
| interpolation | 1501× | 6.2× | 2.6× | 2.2× | **1.6×** |
| loop 50k | - | - | - | 7.4× | **1.9×** |
| **geometric mean** | **27.9×** | **9.2×** | **6.5×** | **3.2×** | **2.8×** |
| **Venn's share of V8** | **3.6%** | **11%** | **15%** | **31%** | **36%** |
| **cold start** | 6.1× | 6.1× | 6.1× | 1.9× | **1.9×** |

**Level 0: work being redone.** Literals were re-parsed on every visit
(`parseNumber`, 9% of `fib`); two plain numbers went through the unit
machinery (`combine`, 5%); and every evaluation of a `"…${x}…"` re-parsed the
placeholder through the whole Langium parser. Fixing the last one alone made
interpolation 248× faster.

**Level 1: allocation per node and per name.** `evaluate({ expr, env })` built
an argument object for each of the ~2.4M nodes `fib(25)` visits; it is
positional now. Scopes were object literals holding fresh closures, a class
with one shared prototype method instead, which also fixed a real bug: scope
lookup used `in`, which walks the prototype chain, so `fn probe() => constructor`
returned JavaScript's `function Object()`.

**Level 2: the tree stopped being walked.** The AST is compiled once into a
tree of JavaScript closures: every operator, literal value, argument-list shape
and string split is decided at compile time and captured, so running an
expression is calling a function rather than re-reading the tree and switching
on it. Names a function binds became array slots in a call frame instead of
lookups by string. `fib(25)` went from 42 ms to 13 ms; `reduce` reached 1.2× of
hand-written TypeScript.

`strings` was resized from 500 to 10k items after level 0: at 0.25 ms it was
measuring the harness rather than the language.

**Then startup, and the statement loop.** Three more findings, each measured
rather than guessed:

- **90% of `venn run` was Node opening files**, resolving 25 plugin packages
  plus Langium and Chevrotain, a package.json and a module at a time. The
  executable is one bundled file now: 483 ms → 256 ms. A launcher that turns on
  V8's compile cache before loading it took another 70 ms.
- **Chevrotain re-validated the grammar on every process start**, 84 ms of the
  147 ms the first parse took, checking generated code that cannot change
  between runs. It ships in production mode; `venn-module.test.ts` runs the
  validation once instead.
- **A `forEach` over 50k was 17× slower than `map` doing the same work.** Not
  the promises, as expected: dispatching a statement ran up to seventeen of
  Langium's `isXxx` guards in sequence, and `isInstance`/`isSubtype` were 16% of
  the run. A switch on `$type` answers in one step. 48 ms → 17 ms.

**Statements: the other half of the language.** Level 2 compiled expressions
and left statements interpreted, which is why a `forEach` over 50k cost 17×
what `map` cost for the same work. Three findings, in the order the profile
gave them up:

- **Dispatch ran up to seventeen Langium type guards per statement**, and
  `isInstance`/`isSubtype` were 16% of the run. A switch on `$type` answers in
  one step: 48 ms → 17 ms.
- **`impliedCall` re-derived on every iteration whether `let y = x * 2` names a
  plugin action**, walking the node through those same guards. The shape of the
  tree does not change, so it is worked out once per node now. The scope and
  registry half stays where it was, because that part genuinely can vary.
- **A block that never suspends now returns no promise at all.** `runBlock` and
  the `forEach` walk stay synchronous until a statement actually suspends, and
  hand the remainder to an async continuation from where it stopped. A loop over
  pure work touches no promises: 17 ms → 4.2 ms.

Altogether `forEach` went from 48.8 ms to 4.2 ms, from 17× what `map` costs to
2.6×.

The profile is now mostly anonymous compiled closures, which is what this is
supposed to look like.

---

## Reading the numbers

**The spread is the point.** Between 0.9× and 26× is not one language being
"3.2× slower"; it is three different regimes.

- **Data work is at parity.** `reduce` is 0.9×, `strings` 1.5×, `branch` 2.0×:
  the loop is native JavaScript and what Venn adds is one compiled closure per
  element. Writing a pipeline in Venn costs about what writing it in TypeScript
  costs.
- **A statement loop costs ~2×.** `forEach` still builds a child scope per item
  where `map` builds none, but it no longer crosses a promise boundary to do it.
- **Calling a function still costs ~21×.** `fib(25)` is ~243k calls of nothing
  but calls, at about 51 ns each: allocating the frame, dispatching through
  `invoke`, and crossing the compiled closures. It is *not* the name lookup:
  the same recursion written to reach itself through a parameter, so that the
  name resolves to a slot, runs 4% faster and no more. Closing that gap means
  emitting JavaScript source, which this project has decided against.

**When the effect is smaller than the noise, count the signs.** Reordering the
member read, so that the four objects a map is not are told apart by one
property rather than by three calls that each re-ask whether the value is an
object at all, moved every case and resolved in none of them: `records 20k` went
-3.7% against a noise floor of 87.5%, and the largest reading on the isolated
member read was -7.9% against 11.5%. What settles it is that thirteen of the
fourteen cases measured, six on the member read alone and eight on the suite,
moved the same way. Under no effect that is one outcome in a thousand. The
change is real and it is one to three percent, which is what a machine this
noisy can say about it.

**Cold start is 1.9×, and most of what is left is Node itself.** 184 ms against
89 ms, of which ~60 ms is building the Langium parser and ~13 ms is running the
program. Registry negotiation for all 25 plugins, which looked like an obvious
target, measured 0.9 ms, which is why it was not done.

---

## Roadmap

Everything above has been done, and two candidates were closed by measuring
rather than by building:

- **Top-level names in slots** would be worth ~4%, bounded by running the same
  recursion with the function passed as a parameter. Not worth a handshake
  between the compiler and the runtime.
- **A packed slots array per call**, replacing `new Array(n)`, which V8 leaves
  holey, made `fib` *slower*, 13.5 ms to 17.3 ms. The extra copy costs more
  than the holey reads at these sizes. Reverted.

What genuinely remains:

1. **The 60 ms parser build** at startup. A serialized parser or a V8 snapshot
   removes it, at the cost of real build machinery. It is now the largest single
   number a user waits on.
2. **A child scope per loop iteration.** `forEach` allocates one even when the
   body binds a single name; the compiler knows which names a block binds and
   could size it, or skip it.
3. **Emitting JavaScript source** for function bodies. The only thing left that
   would move `fib`, and still not recommended, it trades debugging, source
   maps and the sandbox surface for speed few programs here need.

---

## Layout

```
cases/*.vn    the workloads, in Venn
cases/fib.ts    the cold-start twin, run as its own process
src/cases/      the TypeScript twins and the registry
src/harness/    warmup, repetition, median
src/program/       parse once, run many
src/startup/    process-level wall clock
src/report/     the table above
```

Relative imports here end in `.ts`, not `.js` as everywhere else in this
repository. The rule exists because packages are built before they are used;
these files are run straight from source by `node`, which does not remap the
extension.

---

## Profiling

```bash
pnpm --filter @venn-lang/benchmarks run profile fib.vn
pnpm --filter @venn-lang/benchmarks run profile:top
```

Self-time per function, hottest first. `fib.vn` is the clearest signal, it
is nothing but the interpreter, while `strings.vn` shows the Langium parser
running at *evaluation* time.
