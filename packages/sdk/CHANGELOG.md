# @venn-lang/sdk

## 0.8.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.8.1
  - @venn-lang/types@0.8.1

## 0.8.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.8.0
  - @venn-lang/types@0.8.0

## 0.7.5

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.5
  - @venn-lang/types@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.1
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

- [#195](https://github.com/venn-lang/venn/pull/195) [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Every `VNxxxx` a package raises is declared in a catalogue, and a test refuses
  one that is not.

  The kernel's catalogue said it held "every VNxxxx the kernel itself can raise".
  Twenty-three were written where they were thrown, across nine packages,
  including one in `VN9xxx`, a family the specification does not define.

  Five catalogues now: the kernel's, the host and its ports, the two every plugin
  shares, the runtime's own, and the project tooling's. A plugin does not invent a
  family. It uses the one that matches the kind of failure, with a high number in
  that range so it cannot meet a kernel code.

  A stack overflow used to arrive as the machine's own sentence, with no code at
  all. It is `VN8003` now, and reads as what happened:

  ```
  VN8003  This went too deep: something calls itself and never stops.
  ```

- [#309](https://github.com/venn-lang/venn/pull/309) [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - What a value is, and what it answers to, is decided in one place.

  ```venn
  const m = { name: "ada" }
  print m["toString"]     # was a host function; now null
  print m["constructor"]  # was a host function; now null

  let p = { a: 1 }
  p["constructor"]["prototype"]["pwned"] = 7
  ```

  That last line polluted every object, list and string in the process, across
  concurrently running flows, and `venn check` said nothing about it. It is now
  `VN3023`, from every route: a computed key, a key out of a `forEach`, a list
  index, a nested write, inside a `fn`, inside a step and inside a fragment.

  Six classifiers disagreed about what a value is. `typeName` trusted any `kind`
  string an object carried, so an ordinary map `{ kind: "size", label: "x" }`
  answered `"size"` to `typeOf` and `null` to `.label`, while the checker typed
  that same field as a string. The unit guards asked only for a `kind`. `isData`
  re-inlined the four unit names. `tableFor` knew ten kinds, `memberKind` seven,
  and `structured` had an order of its own. `core/src/value/` owns the question
  now, and `kindOf` answers from a closed set, so `typeOf` can never hand back a
  name the language does not have.

  A unit is recognised by its base field as well as its kind: a duration needs a
  numeric `ms`, a size a numeric `bytes`. A symbol brand would have been tighter
  and was rejected, because `structuredClone` drops symbols and `std-db` clones
  every row it hands back, so a duration read out of a query would have stopped
  being one.

  **Three readers became one.** `memberValue` had five guards, `elementAt` had
  none, and `read-path.ts` had `Array.isArray` and answered `undefined` where the
  language has one nothing. Reading a member and reading an index are one
  question, so they now go through one answer, and a position is a position in
  both spellings: `xs[0]` and `xs["0"]` are the same element, `m[1]` and `m["1"]`
  are the same key. The checker learned the same rule, so `const t: number =
m["name"]` is refused exactly as `m.name` always was, and `names["len"]` stops
  being typed as an element.

  **A duration literal is accepted where a duration is declared.** `{ over: 30s }`
  was refused with `"over" is not a valid option.` while `{ over: "30s" }` ran,
  on all six option keys the SDK's own duration primitive guards, because the
  schema was a union of a string and a number and a Venn duration is neither. The
  one exception, `mock.clock`, worked only by unwrapping the value by hand.

  The message was wrong as well as late. A union rejection carries no `expected`,
  so every one of them fell through to the sentence that says the option does not
  exist. The option existed; the value was the wrong shape, and it says so now,
  at check time as well as at run time.

  Five hand-rolled duration unwrappers gave four different answers to "what is
  this if it is not a duration": `NaN`, `0`, `undefined`, and `0` inside
  `undefined`. There is one, and a deliberate line through it: recognition
  tolerates a non-finite `ms`, because `1s / 0` legitimately makes one and
  printing it as a map would be the leak this change exists to close, while
  acceptance refuses it one step before it becomes a timer.

  **One byte module.** Six base64 encoders differed on UTF-8, on stack safety and
  on what they raised. `auth.basic("user", "señha")` sent latin-1 bytes where RFC
  7617 requires UTF-8, so the server answered 401 and nothing said why; with a
  character above U+00FF it threw a bare `Invalid character` with no code and no
  location; and 200 KB through `crypto.base64.encode` raised `VN8003`, "something
  calls itself and never stops", for a program containing no recursion.

  The shared module uses no `btoa` at all. `btoa` cannot do UTF-8, the usual way
  of feeding it is the spread that produced the false `VN8003`, and it is not
  everywhere this has to run. Encoding is alphabet arithmetic and cannot raise;
  decoding refuses with `VN7003`.

  `CryptoEnginePort` moved beside it so `auth.hmac`, `auth.totp` and `auth.jwt`
  reach the bound engine rather than the global one, which is what makes a fake
  engine reach them. And a token is now what it says it is: `auth.jwt` wrote the
  caller's `alg` into the signed bytes and signed with SHA-256 regardless, so
  `crypto.jwt.verify` read `HS512`, hashed with SHA-512 and answered false for a
  token nothing had touched.

  **One owner each**, for ten things written several times: which file a node came
  from, the span of a `${…}` slot, the unlocatable span, whether a node sits
  inside a decorator, the "a, b or c" sentence, the name you probably meant, one
  problem on a node, the tree inside an editor document, a path as a person reads
  it, and the derived-types layout. The first was user-visible: the same `VN3015`
  printed `at orders.vn:3:16` through the scheduler and no location at all inside
  a compiled `fn`, and the corpus that exists to catch that divergence recorded
  neither a uri nor a line, so it could not. It records the uri now, and went red
  before it went green.

  Three Levenshtein cutoffs disagreed about the same typo, so `tkn` reached
  `token` from the option checker and nothing from the three checks next door.
  There is one, and it is length-aware in both directions: a two-letter name no
  longer suggests every other two-letter name.

  **Thirteen declarations that promised something.** `Problem.docs` was declared,
  printed, published to programs as `error.docs`, and set by nobody; it is derived
  from the code, in one place, and the editor renders it as a link. `optional =
true` on a dependency said "installed only on demand" and was always installed.
  `venn verify-plugin` promised to exit 1 when the shape is wrong and its whole
  verdict was that the plugin had a name and a namespace, which the loader had
  already required; it checks the actions, the matchers and the capabilities now.

  The rest are gone: `PluginDefinition.types` with the eight orphaned schemas that
  would have outlived it, `PluginDefinition.version`, `ctx.redact`, `toGraph`,
  `runStatements`, `never`, and five port descriptors nothing bound. `toGraph` is
  worth naming: on a four-construct program it produced five nodes and one edge,
  silently dropping the `else` branch, `run`, `try`, `match` and the whole
  fragment, and the companion it was sold beside has no implementation anywhere.

  **Breaking for a published package.** `PluginDefinition.version` was required, so
  a plugin literal outside this repository stops compiling until the line is
  removed; nothing ever read it. `PluginDefinition.types`, `ctx.redact` and the
  five descriptors go the same way, and `@venn-lang/fmt`'s renderers take the
  language's writer now rather than each keeping their own.

  That last one is the smaller half of a real defect: `[{ took: 250ms }]` rendered
  as `250ms` through `fmt.table` and interpolation and as `{"kind":"duration",
"ms":250}` through csv, yaml, xml and json, and a regex or a task rendered as
  its own internals, `"compiled":{}` and `"promise":{}` included. Six surfaces,
  one answer.

- [#250](https://github.com/venn-lang/venn/pull/250) [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One renderer behind a failing check.

  `print` and `"${…}"` share a definition, and so does `io.print`. A failure title
  did not: `@venn-lang/assert` carried a renderer of its own, with its own rule
  against `[object Object]`, its own quoting and its own fallback to JSON. So
  `print row` gave `{ status: "pending" }` and the red check on the next line gave
  `{"status":"pending"}`, and a duration read as `{"kind":"duration","ms":300}`
  where the print above said `300ms`. It is the worst place for a second answer,
  because a failure is read by somebody who already does not understand what
  happened.

  The renderer lives in `@venn-lang/core`, which a plugin may not depend on, so
  the runtime hands it over, as it already does for actions. `MatcherContext`
  gains `show(value)`, required for the same reason it is required on
  `ActionContext`: an optional member reads as an invitation to write the fallback
  that becomes the second definition. `message` and `detail` receive the context
  as a second argument. `test` does not: a verdict is reached by comparing values,
  and a matcher holding a renderer while deciding one is a matcher that can
  compare their text instead.

  What `@venn-lang/assert` still decides is width, not shape. A title is one line,
  so a side past that budget is cut where it stands and marked with `…`, rather
  than rewritten into prose about the value's shape. A string on the line is
  quoted, the one place a value reads differently from a value on its own, because
  `expect "200" equals 200` failing with `expected 200 to equal 200` is a line
  nobody can act on.

- [#249](https://github.com/venn-lang/venn/pull/249) [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One renderer for every verb that writes a value.

  `print` and `str` share a definition with `"${…}"`. `io.print` did not: the
  plugin carried a renderer of its own that answered with JSON, so `print
{ hits: 0 }` gave `{ hits: 0 }` and `io.print { hits: 0 }` gave `{"hits":0}`,
  while the verb's own documentation called itself the same verb under its full
  name.

  A plugin cannot reach the renderer, which lives in `@venn-lang/core`, and copying
  it in is what produced two definitions the first time. So the runtime hands it
  over instead. `ActionContext` gains `show(value)`, the runtime binds it to
  `displayValue`, and `io.print`, `io.write`, `io.eprint` and the question
  `io.ask` puts on the screen all go through it.

  `show` is required rather than optional, and that is the point of it. An
  optional member reads as an invitation to write a fallback, and the fallback is
  how the second definition gets born again. The runtime builds the context in one
  place, so there is one place to satisfy it.

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

- [#194](https://github.com/venn-lang/venn/pull/194) [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Remove resources, which nothing opened.

  `defineResource` and `PluginDefinition.resources` were SDK API. The `browser`
  plugin filled the field with two, and said so itself:

  ```ts
  /**
   * `open` hands back a placeholder handle and `close` does nothing, because the
   * runtime does not execute `resource` declarations yet.
   */
  ```

  `buildRegistry` never read the field, the grammar has no `resource` declaration,
  and the two mentions in the scheduler were comments describing something that
  did not happen.

  Holding something open across steps already has a spelling, and an explicit one:

  ```venn
  const conn = db.connect url
  defer {
    conn.close()
  }
  ```

  What a resource would have added over that is a shared lifetime: one browser per
  worker, opened once, torn down in reverse order. Worth building the day there is
  a real consumer to shape it, which the only one here was not.

  The editor stops documenting three other things the language does not have
  (`factory`, `dataset`, `report`), and `use` now hovers as removed with what to
  write instead, the way `capture` already did.

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

- [#244](https://github.com/venn-lang/venn/pull/244) [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Five codes reserved ahead of the fixes that will raise them: `VN2023` for a
  name a `deco` body reaches for before expansion has bound it, `VN5006` for
  `==` or `!=` between two lists or two maps (reference equality, always
  false), and `VN7022`, `VN7023`, `VN7024` for a connection refused, a host
  that did not resolve, and a request that timed out.
- Updated dependencies [[`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e)]:
  - @venn-lang/contracts@0.7.0
  - @venn-lang/types@0.7.0

## 0.6.0

### Minor Changes

- [#150](https://github.com/venn-lang/venn/pull/150) [`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The constants and functions a number has no member for.

### Patch Changes

- Updated dependencies [[`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/contracts@0.6.0
  - @venn-lang/types@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.5.0
  - @venn-lang/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10)]:
  - @venn-lang/types@0.4.0
  - @venn-lang/contracts@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`cd42016`](https://github.com/venn-lang/venn/commit/cd420167006ad0ac34dc57dd7a6676516e1ca97d)]:
  - @venn-lang/contracts@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [[`906eb82`](https://github.com/venn-lang/venn/commit/906eb826eb0130f198d52ffa03903be54eacfd89)]:
  - @venn-lang/contracts@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.0
  - @venn-lang/types@0.1.0
