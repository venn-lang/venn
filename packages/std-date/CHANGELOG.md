# @venn-lang/date

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.4
  - @venn-lang/sdk@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.3
  - @venn-lang/sdk@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.2
  - @venn-lang/sdk@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.1
  - @venn-lang/sdk@0.7.1
  - @venn-lang/types@0.7.1

## 0.7.0

### Minor Changes

- [#312](https://github.com/venn-lang/venn/pull/312) [`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The language stops saying yes and meaning nothing.

  ```venn
  fn portOf(text) => try json.parse(text).port else 8080

  fn g(raw) {
    if raw.test("^[1-9][0-9]*$") == false { fail "not a number" { code: "cfg.empty" } }
    return raw.toNumber
  }
  ```

  Neither of those compiled this morning. A `fn` could not `fail`, so the most
  common shape in a real program, take input and refuse what is wrong, cost a
  `fragment` plus `run … as`. Raising is control flow rather than an effect on the
  world, so `fail` is legal in a pure body at any depth, both `try` spellings work
  there, and purity moved out of the grammar into the checker where it reads the
  resolved callee. `json.parse` stays legal because `venn/json` asks the host for
  nothing; `io.eprint` is refused wherever it is written, which is the hole that
  let a side effect run inside something the language called pure.

  ## What this fixes and how it was found

  Three programs were written from scratch against the language: a word-frequency
  CLI, a JSON filter and an amortisation solver. All three work. The first hour
  produced twelve causes, a second survey mapped the grammar's termination rules
  into eight more, and a third sweep of 47 probes found the shape underneath all
  of them.

  **The language said yes and meant nothing.** An unknown name became `dynamic`,
  a bad number became `NaN`, `Infinity`, `[]` or `null`, and a mismatched
  structure was truncated to the part that fit. Every case produced a reader who
  believed they had succeeded.

  ```venn
  print 1 print 2                     # printed `1 null 2`
  let q: banana = "a"                 # accepted, and checking went off for `q`
  import { fs } from "venn/fs"        # exit 0, before `venn/fs` existed
  xs.map(x => x.nope)                 # unchecked, while `xs[0].nope` was fatal
  rows.push(3)                        # a new list, discarded, in silence
  [1, 2, 3].take("abc".toNumber)      # `NaN` became `[]`
  loop s = { a: 0, b: 9 } { continue { a: 1 } }   # `b` gone, nothing said
  forEach [a, b, c] in [[1, 2]] { }   # `c` bound to nothing
  ```

  Every one of those now reports, and the CLI that shipped in that first hour is
  the proof: `wordfreq --top abc` printed a header, no rows, and exit 0. It exits
  1 with `VN3016 · "abc" is not a number.` and a line number.

  Nine new codes, each catalogued: VN1004 a string cut short inside its own
  `${…}`, VN1005 an operator the language does not have, VN2027 an action read
  where a value was wanted, VN2028 a package nothing publishes, VN3024 `+` on
  strings, VN3025 a read through a value that may be nothing, VN3026 a pattern
  naming more items than there are, VN3027 a `continue` that drops loop state,
  VN3030 arithmetic with no number to answer with, VN3031 an argument out of
  range, VN5009 a pure result nothing keeps, VN5010 a verb in a lambda. Three
  codes gained a second raiser rather than a sibling: fn, lambda and fragment
  arity moved onto the VN3002 that already meant it, so `expected fn(number) -> a,
found fn(a, b) -> a` is now `` `f` takes 2 arguments, and got 1. ``

  ## The messages that sent people the wrong way

  The removed-keyword table had one row, `while`, so the language rewarded typing
  a keyword it had deliberately dropped and punished typing the one every other
  language uses. `for r in rows {` said the brackets were wrong. The brackets were
  fine, and it cost five hand-rolled counter loops before `forEach` was found.

  ```
  for r in rows {     was  An argument is one value, so `in` has to be bracketed.
                      now  Venn has no `for`.  Write `forEach r in rows { print r }` …
  ```

  `;` has always been a statement separator and nothing said so: the only two
  places the language stated its own rule were `//` comments, and the generator
  for the specification's grammar section dropped every `//` line. Seven code
  fences in the specification depend on `;` and none introduced it. The rule is
  now prose in section 02 and the comments survive into section 21.

  The parser had never once told anybody a newline was what it wanted. Twenty-odd
  different mistakes read `Expected a closing brace here, found …` because the
  failure is always a `CONSUME('}')` whose expected set has one member. Twenty-six
  rows now name the separator, computed from the generated grammar rather than
  hand-listed, so a keyword added to the language reaches these messages with no
  edit.

  A runtime problem carried no source location while a static one did, which is
  backwards: the runtime one fires on real data when the author is furthest from
  the source. `VN3012 · Operator "*" cannot be applied to these values` is now
  `… to "lots" (a string) and 1 (a number)` with `at file:line:col`. Carrying the
  span on every operator node measured free; carrying it on every call cost 12.7%,
  because a function holding a `try` is not inlined, so the node goes in as an
  argument and only the failing branch reads it.

  ## What the language gained

  **A filesystem.** Twenty-three namespaces including MQTT, gRPC, JWT and
  ninety-six faker verbs, and nothing could read a file. `venn/fs` has four verbs
  over the port that already existed, with its conformance suite unchanged.

  **`venn run` and `venn check` are one compiler.** A program that ran clean and
  failed `check` was possible; diagnostics arrived twice and out of order; and any
  CLI written in Venn died under `| head` with a raw Node `EPIPE`. One pipeline,
  deduplicated, in reading order, and a broken pipe leaves quietly.

  **A chain wraps.** `xs` then `.filter(…)` then `.len` across three lines needed
  brackets whose only purpose was to defeat the lexer. Instrumented and run over
  all 147 `.vn` files in the repository: it fires zero times, so no existing file
  lexes differently.

  ## Purity is about effects, and both halves are now verified

  `PluginDefinition.requires` decides whether a `fn` may call a verb, and it was a
  promise nobody checked: `venn/math` declared nothing while publishing
  `math.random`. A guard now refuses a plugin whose actions reach a port it did
  not declare, and an action may declare itself pure only if it reaches no port at
  all. Neither is a promise any more.

  ## What two adversarial reviews found, and what closed it

  Both reviewers returned `overall_correctness: incorrect` against this branch and
  both verdicts were accepted before anything shipped. Twenty findings, five of
  them P1, every one reproduced against the built CLI rather than argued from the
  diff. The four that changed behaviour rather than prose:

  **A raise bound to a name had two types and neither fitted.** `let stop = fail
"no"` compiles through `compileBoundRaise`, which answered a `Step`, while the
  binding it feeds wants a `Thunk`. A raise never returns, so it is neither: it is
  `(env: EvalEnv) => never`, which satisfies both without a cast. Typing it as
  either one alone would have forced a cast at the other, and a cast there asserts
  exactly the thing the signature exists to prove.

  **A lambda with a name was told to rewrite itself as a loop.** The way out of a
  pure body was chosen by asking whether the node was inside a lambda at all, so
  `let f = fn () { io.print "x" }` got the advice written for
  `rows.map(fn (n) => …)`: build a `let xs = []` and a `forEach`. It has a name, so
  it can simply be lifted. The choice now walks to the nearest body and asks
  whether that body is an argument of a call, which is the thing that actually
  decides whether a `fragment` is reachable. Two copies of that sentence existed,
  in `core` and in `runtime`; the one in `runtime` is deleted and the one beside
  the walk that chooses it is the owner.

  **A closer that closed the wrong bracket reported twice.** `print(1}` earned the
  sentence about the `}` and then a second about the file ending at the `(`. Both
  bracket faults leave the opener standing, so both swallow the rest of the file,
  and the cut that already existed for one now answers for both. It has to cut
  from the **opener**, not from the error: a mismatch is raised at the closer while
  the parser's complaint about the same bracket sits earlier in the file, so
  cutting at the closer would have kept the second sentence.

  **`VN3010` printed the name-only advice on an index read.** `read-through-nothing.ts`
  had already solved this: `wayPast` returns the shared line only for a plain
  reference and builds the tailored clause otherwise. `helpAboutNothing` took the
  two types and never the node, so the caller could not reach the fix in its own
  file. It takes the node now.

  The last one is the one worth keeping. Its test ran both spellings and passed,
  because running a spelling proves the spelling exists; it does not prove the
  repaired program is silent. That is the distinction this changeset draws at
  length two sections below, and this is the case that slipped through it inside
  the file that documents it.

  ## Two things this deliberately does not do

  `+` still does not join strings. The compiler used to suggest
  `print ("a" + "b")` and then reject exactly that; it now says
  `` `+` adds numbers; it does not join strings `` and hands back the reader's own
  operands as an interpolation. A second way to join strings is not an
  improvement.

  A `"` inside a `${…}` is still refused. A regex terminal cannot count nesting
  and a mode-based lexer would risk every string in every program to save one
  character in a case that already has an answer. What is fixed is that the
  failure used to invent a name: `print "core: ${m["core"]}"` said
  `Nothing is named "core" here` and now says the string ends at that quote, with
  the single-quote spelling built from the reader's own placeholder.

  ## How this was checked

  Every help line was executed before it shipped. That rule caught three invented
  spellings, including `set a to a + 2`, which is not Venn and which was about to
  be printed as the fix for `a += 2`, the suggest-then-reject defect reproducing
  itself inside its own fix.

  It was not enough. `forEach r in rows { print r }` runs perfectly and was still
  the wrong advice for `let z = rows.forEach(r => print r)`, because it silently
  deletes the binding. `print(1,)` is legal in a list and not in an argument list,
  so telling the reader of `print(1;)` to write a comma handed them the worst
  message in the language. **Running a fix proves the spelling exists; it does not
  prove the fix fits the program that earned it.** The cheap test is whether the
  rewrite changes the construct or only a name inside it: only-a-name cannot fail,
  crossing a boundary must be applied to a real earning line and diffed for what
  vanished.

  The best evidence for VN5009 was a near-miss rather than a survey row. While
  restructuring an example under time pressure, an author needed to accumulate
  into a list and wrote `rolls = rolls.push(…)`. The bare `rolls.push(…)` is the
  JavaScript reflex; it would have compiled, run, printed `five rolls: []`, and
  been pinned as correct by a re-record nobody would have questioned.

  There is a third shape, and it is the one every check above survives. A help
  line built by transforming the reader's own text can hand back a program that
  compiles, runs clean, and means something else: the suggestion for
  `print "k ${m["a\"b"]}"` rewrote a key containing a quote into a different key.
  Nothing is missing from the line and there is no error to notice. Help built
  from a fixed template can only ever name a spelling that does not exist, which
  running catches; help built from the reader's input can also change meaning,
  because it cannot tell punctuation from value. Three slices shipped
  rewrite-from-input help, and all three now decline the worked example rather
  than guess when the input holds a character they would have to reinterpret.

  And a fourth, which survives all of those: advice that compiles, passes
  `venn check`, and always fails at run time. `` write `print(…)` to call it `` was
  considered and dropped because an ellipsis is not something a reader can type.
  The better reason arrived later: `const a = print("x")` passes the checker and
  dies with `VN3013`, for every prelude verb, on every input, because reading a
  verb answers `null` and `null` is then called. That is closed here too.

  Two more shapes turned up once the slices went looking. A help line whose
  **factual claim about the reader's data** is unsupportable: a pair guidance that
  said "a two-item list" on a `list<number>`, which carries no arity, is the same
  over-claiming the checker was fixed for. And advice that is correct, compiles,
  and costs a restructure the sentence gives no hint of: `` a verb belongs in a
`fragment`, or at the top level of a file `` is honest for a `fn` whose caller you
  control and misleading for one woven into other `fn`s, where following it moves
  five files.

  And a last one, found by a consolidation rather than by a defect. Routing two
  `Did you mean` sites through one owner proposed rendering both with backticks,
  as every other caller does. Backticks here mean _this is the code, write it_,
  and for every other caller the token shown is the token typed. A module path is
  the one offered name a reader substitutes **inside quotes they already wrote**,
  so the shared spelling would have shipped `` Did you mean `venn/io`? `` and, taken
  at its word, `import { io } from venn/io`, which does not parse. The owner grew
  the distinction instead of being bypassed. **The same words in a different
  syntactic slot are a different claim**, which is how a consolidation ships
  wrong advice with no sentence changed and nobody careless.

  The usable form of the rule is cheap. **A rewrite that touches only identifiers
  is safe. A rewrite that touches punctuation must be applied to a real earning
  line and read back for what it now says, not merely run**, because a delimiter
  escaped is content, which is how a quote-swap changed a map key. Crossing a
  construct boundary has to be diffed for what vanished. And advice that leaves a
  real error behind is correct; advice that leaves an error it created is not.

  All of which reduces to one sentence: **a help line is a claim, bound by the same
  do-not-over-claim rule as a type.** The durable form of the check is a test that
  asserts the repaired program reports **nothing**, rather than that it parses:
  `` ask `if x != null` first `` produced a program that compiled and reported the
  same error again, so parsing is not the bar. Written that way it costs nothing
  extra and cannot rot, where a habit of running it before shipping dies with the
  session. With one honest limit: a slice whose snippets are whole programs can
  assert the checker's silence, and one whose snippets are fragments naming
  `rows` or `n` can only assert its own layer's, because the preamble it would
  need is a test of the preamble. Those slices assert what they can and ran the
  rest by hand.

  And one mechanism under most of it, worth more than the list of shapes. Advice
  built as a **generic exemplar**, a sentence about the language printed at a
  program, can be true in general and wrong here: `if b != 0 { … }` and
  `if x != null` are both correct Venn and both failed on the line that earned
  them, one by scope and one by narrowing something that is not a name. Advice
  built from the reader's own text has no exemplar to be wrong about:
  `"unknown option: " + "x"` can only ever produce `` Write `"unknown option: x"`  ``.
  That is not virtue, it is a property of building the answer from the input, and
  it is the cheapest defence against the whole class.

- [#210](https://github.com/venn-lang/venn/pull/210) [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One rule for when a verb fails, and the verbs that disagreed with it fixed.

  The stdlib answered the same question three ways, and one namespace did two of
  them: `date.in` answered `null` for a timezone that is not one while
  `date.format` refused the same name. Nothing decided this. Each verb was written
  on its own day, so every one had to be looked up, and the one looked up last week
  is the one that ends the run in production.

  The rule is now written where a plugin author reads it, in the SDK's README:

  - **The world failed**, so raise. A refused connection, a driver that is not
    there. Nothing the program wrote is wrong and nothing it can read would help.
  - **The caller made a mistake**, so raise. A timezone that is not one, a range
    whose end is below its start. It is a bug in the program, and the run ending at
    the bug is the shortest way to the fix. That is `VN7005`.
  - **The data was unreadable**, so answer with `null`. Text from a server, a field
    nobody set. Being unreadable is an ordinary thing for data to be.

  A `tryX` twin belongs only where both readings are common enough to want a name
  each, as with `json.parse` and `json.tryParse`, and never as the only spelling.

  ### What changed

  | Verb                    | Was                               | Is                                             |
  | ----------------------- | --------------------------------- | ---------------------------------------------- |
  | `date.in`               | `null` for a zone that is not one | refuses it, as `date.format` already did       |
  | `date.format`           | refused, with no code             | refuses with `VN7005`, and the same words      |
  | `data.range(10, 1)`     | a number outside both ends        | refuses with `VN7005`                          |
  | `data.oneOf()`          | nothing                           | refuses with `VN7005`                          |
  | `math.randomInt(10, 1)` | a number outside both ends        | refuses with `VN7005`                          |
  | `data.json`             | whatever the runtime threw        | refuses with `VN7003`, in the language's words |
  | `json.parse`            | refused, with no code             | refuses with `VN7003`                          |
  | `http.on`               | refused, with no code             | refuses with `VN7005`                          |

  `date.in` no longer answers `null`, so its type is the parts rather than the
  parts or nothing.

- [#295](https://github.com/venn-lang/venn/pull/295) [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The rest of epic [#289](https://github.com/venn-lang/venn/issues/289): three bugs and two catalogues.

  `findProject` walked past the drive root and adopted whatever project the shell
  happened to be standing in, and it was not only `env` that decided: `[paths]`
  came with it, so an isolated file resolved its aliases against a stranger's
  manifest. One upward walk lives in `@venn-lang/contracts` now, under one rule,
  that an absolute walk never yields a relative step. The third copy of it in the
  editor also carried a twelve-directory limit, so a project root thirteen levels
  above an open file was invisible there and visible to the command line.

  The shipped CLI could not load `@venn-lang/dts`, so `venn add` died with
  ERR_MODULE_NOT_FOUND for anybody who installed the documented way. It is bundled
  now, as a chunk of its own that only the command deriving types opens, and a
  guard recreates the shipped layout and runs the binary in it, because reading the
  build config is what let this survive.

  Every `data.*` value came from a process-global generator no host could seed, so
  a flow's values depended on which flows ran before it. `Random` gains `restart()`
  and a flow restarts it, so the same seed gives the same values whatever ran
  first, and `createNodeHost({ seed })` lets a host replay a run.

  A verb or a matcher handed more positional arguments than it takes, or fewer than
  it needs, is now refused with VN3002. Fixing that turned up declarations that
  were simply wrong: `auth.hmac` and `browser.press` had their two arguments
  backwards, and several verbs declared as required what their bodies read by name.

  And twenty-one Venn blocks across fifteen package READMEs did not check. They do
  now, and the guard's list of tolerated refusals is empty.

### Patch Changes

- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e), [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa), [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4), [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/contracts@0.7.0
  - @venn-lang/sdk@0.7.0
  - @venn-lang/types@0.7.0

## 0.6.0

### Minor Changes

- [#152](https://github.com/venn-lang/venn/pull/152) [`2667eb6`](https://github.com/venn-lang/venn/commit/2667eb68a1440a604f36898e777569a6f769680a) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Tell the time, write it out, read it where people are.

### Patch Changes

- Updated dependencies [[`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/contracts@0.6.0
  - @venn-lang/sdk@0.6.0
  - @venn-lang/types@0.6.0
