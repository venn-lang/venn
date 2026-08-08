# @venn-lang/runtime

## 0.9.0

### Patch Changes

- [#332](https://github.com/venn-lang/venn/pull/332) [`2c4bca4`](https://github.com/venn-lang/venn/commit/2c4bca49caa3515018c224ff2addc2087021ca5d) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A decorator's hook runs in the program, so a decorator can do something.

  ```venn
  deco cooldown(target: Fn, times: number) {
    let calls = 0
    target.wrap(fn (call, args) {
      calls = calls + 1
      if calls > times { fail "on cooldown" { code: "cd" } }
      call(args)
    })
  }
  ```

  Every line of that was refused. `VN2016` for the `fail`, `VN2023` for a name at
  the top of the file, and `VN3021` at the call site for the counter, which
  `venn check` had passed clean.

  A `deco` body runs at expansion and cannot reach the world. That is right and it
  stays. A hook is not the body: `target.wrap(fn (call, args) { … })` hands a value
  over, and the value is called once the program is running. The rule asked
  **where** a call was written rather than **when** it runs, so it answered about a
  moment the hook was not in.

  Three boundaries moved and one did not.

  **The checker stops at a hook.** `enclosingDeco` walks out to the `deco`, and now
  stops at the lambda in between, so the document's ordinary checks apply inside a
  hook and a plugin verb written there is not refused.

  **The reach check stops at a hook.** A name read inside one is the program's to
  answer, so a hook reads a top-level `const` and calls a top-level `fn`. What the
  body itself reads is still refused, with the same sentence and span.

  **A hook is re-seated where both halves exist.** It closed over the `deco` body
  and needs the program too, and the first moment both are in hand is where the
  runtime binds the decorated function. `HookEnv` puts the body first and the
  program behind it, so a decorator's own name wins over one the file happens to
  share.

  State follows from the same place. A `deco` body keeps its bindings in cells, so
  a hook writes what it reads: a counter in the decorator, or one in the file that
  two decorations share. The body's storage is deliberately not called `cell`,
  because an environment that answers `cell` is read as the end of the chain and
  every free name would take an empty one minted at expansion and never ask the
  program again.

  What did not move: a verb or a top-level name written in the `deco` body itself
  is still refused, and `known-gaps.md` entries 23 and 24 close.

- Updated dependencies [[`2c4bca4`](https://github.com/venn-lang/venn/commit/2c4bca49caa3515018c224ff2addc2087021ca5d), [`2c4bca4`](https://github.com/venn-lang/venn/commit/2c4bca49caa3515018c224ff2addc2087021ca5d)]:
  - @venn-lang/core@0.9.0
  - @venn-lang/contracts@0.9.0
  - @venn-lang/prelude@0.9.0
  - @venn-lang/sdk@0.9.0
  - @venn-lang/types@0.9.0

## 0.8.1

### Patch Changes

- [#328](https://github.com/venn-lang/venn/pull/328) [`ac0ff26`](https://github.com/venn-lang/venn/commit/ac0ff2694bdeda916096979b7a0da5a4c4dfebf0) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A `fn` reaches the world. `VN2024` is gone, and with it the rule that no
  callback could do anything.

  ```venn
  fn resumo(url) {
    const res = http.get(url)
    print "buscou ${url}"
    { status: res.status, bytes: res.body.len }
  }
  ```

  Every line of that was refused. So was `rows.map(r => http.get(r.url).status)`,
  so was a handler that queries before it answers, and so was `print` inside a
  function.

  The rule read `PluginDefinition.requires`: a verb whose plugin asked the host
  for a port could not be called from a pure body. It bought one thing, that a
  graph drawn from a program shows everything the program reaches, and it cost the
  whole category of higher-order functions over effects. A `fragment` could reach
  the world and is not a value, so it could not be passed where a callback goes:
  the way out the refusal offered did not exist. That is the trade, made the other
  way round now, because a language whose interesting half cannot be written has
  no graph worth drawing.

  `fail` is unchanged. Raising is control flow rather than an effect, so the
  compiler still builds it into the body instead of calling it: a raise leaves
  before there is anything to bind. A step and an `expect` are still refused by the
  grammar, because neither means anything without a `flow` around it.

  Three things had to be true before the rule could go, and none of them were.

  **Statements now run in order.** A compiled body evaluated its bindings all at
  once and only waited where one was read, so this printed `0`:

  ```venn
  fn probe() {
    const r = http.get(base)
    print "hits after the call: ${hits}"
    r.status
  }
  ```

  The call was still in flight when the line under it read the world. Bindings and
  statements are settled before the one behind them now, in bodies, in loops, in a
  `try` and in its `finally`, which no longer fires while a slow attempt is still
  running. Nothing pays for it until something is actually slow: the check is one
  comparison past the path an ordinary statement takes.

  **A verb statement runs instead of raising.** `compileVerb` built a raise for
  every verb, so with the check alone removed `print "x"` inside a `fn` failed with
  the text it was asked to print. A verb is now the value its name resolves to,
  called with the arguments after it, by the same path `io.print("x")` in an
  expression already took. The prelude verbs `print`, `log`, `wait`, `skip` and
  `exit` are bound as values in the root scope, which is how the engine already
  crossed into a compiled body for every plugin namespace.

  **Collection callbacks wait for what they answer.** Twenty-four of them dropped a
  pending value on the floor, so `[1, 2].map(n => spawn(() => n * 10).wait)` gave
  `[{}, {}]`. It gives `[10, 20]`. This one was broken before any of the rest and
  had nothing to do with purity: it needed a callback that reaches something slow
  before anybody could see it.

  `known-gaps.md` entry 21 closes. Entry 22, a `fragment` that passes `venn check`
  as a value and answers `null` at run time, rises to high: it was survivable while
  a `fragment` was the only body that could reach the world, and now the only thing
  one uniquely does is carry steps.

- Updated dependencies [[`ac0ff26`](https://github.com/venn-lang/venn/commit/ac0ff2694bdeda916096979b7a0da5a4c4dfebf0)]:
  - @venn-lang/core@0.8.1
  - @venn-lang/contracts@0.8.1
  - @venn-lang/prelude@0.8.1
  - @venn-lang/sdk@0.8.1
  - @venn-lang/types@0.8.1

## 0.8.0

### Patch Changes

- Updated dependencies [[`15abec4`](https://github.com/venn-lang/venn/commit/15abec452e2d1135e3885a09a5fbbc2b4b323584), [`5815eb1`](https://github.com/venn-lang/venn/commit/5815eb182b2fb02c388db7481320e40b89c5bdff)]:
  - @venn-lang/core@0.8.0
  - @venn-lang/contracts@0.8.0
  - @venn-lang/prelude@0.8.0
  - @venn-lang/sdk@0.8.0
  - @venn-lang/types@0.8.0

## 0.7.5

### Patch Changes

- [#324](https://github.com/venn-lang/venn/pull/324) [`a6b6ded`](https://github.com/venn-lang/venn/commit/a6b6dedc1c204930cf27e07520e732c6ecebc9c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Every way of importing from JavaScript works, and the ones that cannot are said.

  Four of the six ordinary spellings were broken, three of them in silence.

  ```venn
  import { chunk } from "lodash"
  print chunk([1, 2, 3, 4], 2)
  ```

  `venn check` reported `✓ no problems found`. The run printed
  `VN3013 · This value is not a function: null`, and a program that only read the
  value carried the nothing on into arithmetic.

  |                                        | before                  | now      |
  | -------------------------------------- | ----------------------- | -------- |
  | `import { f } from "esm-pkg"`          | bound, refused the call | works    |
  | `import { f } from "cjs-pkg"`          | `null`                  | works    |
  | `import * as p` then `p.f()` on CJS    | `Type {} has no field`  | works    |
  | `import p from "cjs-pkg"` then `p.f()` | `null`                  | works    |
  | a name the package does not have       | `null`, silently        | `VN2009` |

  ## Four causes, one per symptom

  **A host function was not callable.** `invoke` accepted a `Closure` or a wrapped
  `NativeFn`, and an npm export is neither. It takes a bare function now, in the
  one place a call is made, rather than wrapping at each binding site: wrapping
  would hide what a callable package carries, and `lodash` is a function with the
  whole library set on it.

  **A CommonJS module has no named exports to bind.** Node hands an ESM namespace
  of `{ default, "module.exports" }` and nothing else, so `chunk` was not found,
  nothing was bound, and every read answered `null`. The names inside are opened
  up, with the namespace winning wherever both have one.

  **A member of a function answered `null`.** A function is neither a map nor a
  handle, so the read fell through. It publishes what is set on it directly, and
  never what it inherits: `call`, `apply` and `bind` turn any value into a
  receiver of the reader's choosing, and `name`, `length` and `prototype` are the
  engine's rather than the package's.

  **A package with no types typed as `{}`.** `record({})` refused every member of
  a namespace over a package like `lodash` that ships no types. Publishing no
  types is the absence of an answer, not the answer that it is empty, so it reads
  `dynamic` now, which is what the file beside it already said about a module that
  could not be read.

  ## And the silence

  A name no package publishes is `VN2009`, the same code a `.vn` module earns.
  Both commands answer, from different evidence: `venn run` has the module, and
  `venn check` reads the types `venn install` derived rather than importing a
  package to ask about it, since importing runs whatever the package runs. A
  package that published no types stays unknowable at check time and is left to
  the run.

  Typed packages were already checked and still are:
  `nanoid(1, 2, 3)` earns `VN3002 · nanoid takes 0 to 1 arguments, and got 3`.

- Updated dependencies [[`a6b6ded`](https://github.com/venn-lang/venn/commit/a6b6dedc1c204930cf27e07520e732c6ecebc9c5)]:
  - @venn-lang/core@0.7.5
  - @venn-lang/contracts@0.7.5
  - @venn-lang/prelude@0.7.5
  - @venn-lang/sdk@0.7.5
  - @venn-lang/types@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.4
  - @venn-lang/core@0.7.4
  - @venn-lang/prelude@0.7.4
  - @venn-lang/sdk@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies [[`ea73ed7`](https://github.com/venn-lang/venn/commit/ea73ed7dd1cc3c68797fcde4459677b45c41ac67)]:
  - @venn-lang/core@0.7.3
  - @venn-lang/contracts@0.7.3
  - @venn-lang/prelude@0.7.3
  - @venn-lang/sdk@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.2
  - @venn-lang/core@0.7.2
  - @venn-lang/prelude@0.7.2
  - @venn-lang/sdk@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.7.1
  - @venn-lang/core@0.7.1
  - @venn-lang/prelude@0.7.1
  - @venn-lang/sdk@0.7.1
  - @venn-lang/types@0.7.1

## 0.7.0

### Minor Changes

- [#208](https://github.com/venn-lang/venn/pull/208) [`8fcf804`](https://github.com/venn-lang/venn/commit/8fcf804d597e0cc9842e06da2be8a76543c6d7fb) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A failure is a value a program can read.

  ```venn
  fragment charge(order) {
    if order.amount > limit {
      fail "over the limit for this card" { code: "pay.limit", data: { over: order.amount - limit } }
    }
  }

  try {
    run charge(order)
  } catch e {
    if e.code == "pay.limit" {
      print "try ${e.data.over} less"
    }
  }
  ```

  What `catch` bound was two fields built by a three-line function, bound as
  `dynamic`. Everything else the failure knew, where it happened, what would help,
  what the docs say, was rendered to a terminal and thrown away before the program
  that caught it could see any of it, and `e.nowhere` passed `venn check` without a
  word.

  It is now the `error` type, which the language brings with it beside `regex` and
  which is opaque for the same reason: `code`, `message`, `where`, `help`, `docs`
  and `data` are the whole of it, and a member it does not have is refused where it
  is written. Each is `null`, never absent, when the failure carried none.

  The flow trace is not there. It holds spans of files the program may never have
  opened, and handing those to a `catch` makes a failure a window into the whole
  run rather than an account of one thing that went wrong.

  `fail` now carries a code and a payload, so a library can raise a failure a
  caller can tell apart. Without one it still raises `VN6002`.

  Codes beginning `VN` belong to the language: every one is catalogued and
  searchable, and a program raising `VN7010` to mean its own thing is a program
  whose failures cannot be told from the language's. That is `VN3022`, reported
  where the code is written, or where it is raised when the code was computed.

- [#196](https://github.com/venn-lang/venn/pull/196) [`8e9cbd9`](https://github.com/venn-lang/venn/commit/8e9cbd98e623c98f95bb28386a75c4905d35c499) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `pub import` publishes what it brings in, which it has parsed and ignored until
  now.

  ```venn
  # lib/cart/mod.vn
  pub import { total } from "./total.vn"
  pub import * as coupon from "./coupon.vn"
  pub type Item = { sku: string }
  ```

  ```venn
  import * as cart from "./lib/cart/mod.vn"
  cart.total(items)
  cart.coupon.apply(t, code)
  ```

  The grammar carried the `pub` on an import since imports were written, and
  nothing read it. A file that trusted it published nothing, and the failure
  arrived wherever the name was used.

  It travels by value and by type, under whichever name the handing file gave it,
  through a wildcard, and further than one hop. What is not marked stays private.

  What a module offers is now asked in one place, since three readers needed the
  same answer and each worked it out separately: the binder, the type checker, and
  the check that refuses an import of a name nobody published.

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

- [#193](https://github.com/venn-lang/venn/pull/193) [`750e2ab`](https://github.com/venn-lang/venn/commit/750e2ab0c635b4c92b196192ad995d1aa22f1dc4) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A default import from a `.vn` module is refused rather than left holding nothing.

  ```venn
  import lib from "./lib.vn"
  ```

  ```
  VN2009 · A `.vn` module publishes by name, so it has no default.
    help  Write `import { lib } from "./lib.vn"`, or `import * as lib` for the whole of it.
  ```

  The spelling is not dead syntax: a package has a default export and the binder
  reads it. A module is the opposite case, publishing by name with `pub` and
  having no default at all, so the field was never read.

  A package that has no default export is now the same diagnostic, instead of a
  binding of nothing.

- [#191](https://github.com/venn-lang/venn/pull/191) [`1d9bbbc`](https://github.com/venn-lang/venn/commit/1d9bbbc3586f9a429ed0837a343fb85e3b2cd72e) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `VN2020`: a name bound twice in one file says so, and shows both.

  ```venn
  import { json } from "venn/json"
  const json = { parse: (x) => "mine" }

  print json.parse("{}")     # "mine"
  ```

  ```
  VN2020 · "json" is already the name of something in this file.
    at    main.vn:2:1
    help  Rename one of them, or bring the first in under another name with `as`.
    see   main.vn:1:1  `json` is bound here
  ```

  The second one won and said nothing, so every `json.something` below it quietly
  called the wrong thing. Two imports binding one name did the same.

  Removing `use` was about a file saying what it takes, so a reader finds out
  where a name came from by reading the top. A name that means one thing at the
  top and another thirty lines down takes that back.

  Only the top level: a name bound inside a function or a step is a local, and
  shadowing is what a local is for.

- [#200](https://github.com/venn-lang/venn/pull/200) [`27b3667`](https://github.com/venn-lang/venn/commit/27b3667838788859800928d540991053f63051e4) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A name can be given a new value.

  ```venn
  let total = 0
  forEach price in prices {
    total = total + price
  }
  ```

  `x = 1` did not parse, anywhere. The only state that moved was a loop's own, so
  every shape that was not a fold had to be bent into one, and the two constructs
  that most want to hand a value outward, `try` and `if`, are statements.

  `let` names what changes and `const` names what does not, which is the first
  thing that has ever distinguished them. Writing to a `const` is refused where it
  is written, with the word to use instead.

  What `const` fixes is the name, not the value: `const cart = { … }` says `cart`
  names one map for good, and the map is written into like anything else. Writing
  a field or an item reaches the value itself, so everything holding that value
  sees it.

  **A function captures the binding, not a copy of it.** What it reads is what the
  last assignment left. That falls out of how the kernel already works: a compiled
  function addresses a cell, and an assignment writes through the same cell.

  A parameter is a binding like any other, so it takes one too. What is written
  has to fit what the name holds, by the same rule wherever it is written.

- [#217](https://github.com/venn-lang/venn/pull/217) [`9918c2d`](https://github.com/venn-lang/venn/commit/9918c2d36ecec2d9f18a60997bcc50806a71ba23) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A namespace can be written in Venn.

  ```venn
  pub namespace coupon {
    const table = { black: 0.3 }         # private to the block
    pub fn apply(total, code) => total * (1 - table[code])

    pub namespace stacking {
      pub fn allowed(a, b) => a.kind != b.kind
    }
  }
  ```

  One could be published by a plugin or made by a file, and there was no way to
  write one: a file that wanted to group two families of names had to become two
  files, and a name that only makes sense beside three others sat at the top level
  with everything else.

  This is a fourth spelling of one thing rather than a fourth thing. `pub` decides
  what leaves, exactly as it does in a module, so there is no second rule; what it
  does not mark stays inside for the rest of the block, and is not on the value nor
  known to the checker. It nests, and a `pub namespace` is published by its module
  and arrives through `import`.

  The checker gives it a record of what it published, so `coupon.applyy` is a
  `VN3010` where it is written rather than a `null` somewhere later.

  Reopening one another file declared is deliberately not among the three ways a
  namespace comes to exist, and neither is replacing a verb in one. Removing `use`
  was so a file says what it takes; a namespace a third file can add to puts that
  back one level down.

- [#249](https://github.com/venn-lang/venn/pull/249) [`fa999b7`](https://github.com/venn-lang/venn/commit/fa999b75d85bece59dbfa7fe6994a779f9230d4b) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `{ concurrency: n }` on a `forEach` inside a `fn` now says it cannot be honoured.

  ```venn
  fn total(orders) {
    let sum = 0
    forEach one in orders { concurrency: 4 } {
      sum = sum + one.amount
    }
    return sum
  }
  ```

  A `fn` is pure and has no scheduler to ask for a pass out of order, so the
  compiled loop above always ran its passes one at a time, exactly as `forEach
one in orders { }` without the option would. The option itself was read and
  silently thrown away, so the difference between asking for four in flight and
  getting one was something only a stopwatch could find.

  `venn check` now refuses `concurrency` where it is written inside a `fn`, with
  `VN5008`, saying that a pure body runs one pass at a time and that a
  `fragment` is where concurrent work belongs. The same option at the top of a
  file, or inside a `flow`'s `step`, is untouched: a `forEach` there still runs
  through the scheduler, which can honour it.

- [#249](https://github.com/venn-lang/venn/pull/249) [`51d879e`](https://github.com/venn-lang/venn/commit/51d879e39b6d186f4306c42b26a995ba67a12643) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The argument a verb swallows is caught wherever it happens, not only in three names.

  ```venn
  import { io } from "venn/io"

  io.print { a: 1 }
  ```

  `print { a: 1 }` has said `VN5002` since the lint family existed: a trailing
  `{ … }` on a verb is always its options, so this hands over nothing and prints
  an empty line. The rule was checked for `print`, `log` and `skip` by name,
  because those three are the language's own and take no options at all. A
  plugin's verb in the same shape said nothing: `io.print` is the same verb
  under its full name, but it was not on the list, so the map above vanished
  just as quietly.

  The rule was never really about those three names. It is about a verb that
  declares no options schema at all, prelude or plugin's alike: nothing there is
  free-form the way `grpc.request`'s catchall map is, so a bare `{ … }` is read
  as options it does not have. `fail` is the one prelude verb this leaves alone,
  since `{ code, data }` is genuinely read there, informally rather than
  through a schema.

  The three names now report `VN5007` instead of `VN5002`, alongside every
  plugin verb the same rule now reaches. One rule said one way, rather than the
  same rule in two codes depending on where the verb came from.

  A verb legitimately joined to the next by `;` on one line, such as `mock.reset;
mock.start "payments"`, is unaffected: the semicolon is read as the deliberate
  separator it is, not as the sign of a verb handed something it could not take.

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

- [#244](https://github.com/venn-lang/venn/pull/244) [`e321379`](https://github.com/venn-lang/venn/commit/e32137978e97bc5b2c8fb5d14af20685f46ad8b5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Wire the three fixes that needed the runtime to reach them.

  A decorator written in an imported file now takes effect, because the runner
  hands `expand` the import graph it was already holding. Reaching for a name a
  `deco` body cannot have is refused by `venn check`, at the name, rather than only
  by the run that had already printed the wrong answer. And a `loop` whose state
  advances by assignment ends: the name was re-set from the carried value at the
  top of every pass, so the assignment was written and then overwritten, and the
  loop ran for ever without reporting anything.

  The three are in `@venn-lang/core` and were inert without these, which is why
  they are one changeset.

- [#183](https://github.com/venn-lang/venn/pull/183) [`6a01684`](https://github.com/venn-lang/venn/commit/6a016840bf5eb819d8578be29dff18b81bb8dfba) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `VN2018`: a name nothing binds is said where it is written.

  ```venn
  const total = 100
  const desconto = 0.1

  print (total * (1 - descnto))
  ```

  ```
  VN2018 · Nothing is named "descnto" here.
    Did you mean `desconto`?
  ```

  Before this, `venn check` passed the file and the run said
  `Operator "-" cannot be applied to these values.`, which is true, useless, and
  points at the operator rather than at the typo.

  There was no code for it: the catalogue had one for an unknown action, an
  unknown fragment, an unknown env key and a namespace nobody imported, and
  nothing at all for a name that is not bound.

  The check is deliberately blunt about scope. It asks whether a name exists
  anywhere in the file, never whether it is in scope at the point it is read, so a
  function that calls one declared below it is not reported. Scope is the harder
  question and it is not the one a typo needs answering, and a diagnostic that is
  wrong even sometimes is one people learn to ignore.

  A bare name inside a decorator stays a word: `@tags(smoke)` names a tag, and a
  decorator runs before there is a program for one to refer to.

- [#185](https://github.com/venn-lang/venn/pull/185) [`9948d96`](https://github.com/venn-lang/venn/commit/9948d96ba4753c718115f99150fcd8938c27b7ca) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A verb a namespace does not publish is refused where it is written, wherever it
  is written.

  ```venn
  import { json } from "venn/json"
  print json.pars("{}")
  ```

  ```
  VN2003 · "json" does not publish "pars".
    Did you mean `json.parse`?
  ```

  The statement form (`json.pars "{}"`) has been refused since `VN2003` existed.
  The same mistake inside an expression reached nobody: the type of an unknown
  verb is `dynamic`, so the checker had nothing to say, and the run failed a line
  later with `This value is not a function, so it cannot be called: undefined.`

  The registry already holds every verb of every namespace, which is where the
  suggestion comes from, under whichever name the import gave the namespace.

  A local binding of the same name still wins, as it does when it runs, and a
  constant the namespace publishes is not reported as missing: `math.pi()` is
  wrong for another reason and in another sentence.

- [#192](https://github.com/venn-lang/venn/pull/192) [`1d940c8`](https://github.com/venn-lang/venn/commit/1d940c87e2ec3c60856d0e635f7d32658f9b2cd3) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `VN2021`: files that import each other are refused, with the way round shown.

  ```
  VN2021 · Importing "./a.vn" here closes a circle.
    at    b.vn:1:1
    help  Move what both files need into another one, and import that from each.
    see   a.vn:1:1  imports b.vn
    see   b.vn:1:1  imports a.vn
  ```

  They used to run. The walk skipped a file it had already seen, which ended the
  loop and left one module half built: a `const` at the top of a file is evaluated
  when the file is, and a `pub fn` closes over the file it was written in, so one
  side reads what the other has not filled yet. Which side depends on which file
  the run entered first.

  The circle reads the same whichever file leads into it, so `venn check` over a
  folder reports one mistake rather than one per door.

  Two files importing the same third is not a circle, and never was.

  `venn run` now refuses an import that leads nowhere too, which `venn check` has
  said since `VN2019` but the runner did not.

- [#187](https://github.com/venn-lang/venn/pull/187) [`1411452`](https://github.com/venn-lang/venn/commit/141145211d7797116ecf753226a3781ea2c664e6) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `venn check` now refuses what `venn test` refuses.

  ```venn
  @banana
  flow "F" {
    step "s" { expect 1 == 1 }
  }
  ```

  ```
  venn check   ->  ✓ no problems found       exit 0
  venn test    ->  VN2013 · No decorator is named "@banana".   exit 1
  ```

  A checker that misses what the runner catches is worse than no checker: it is
  the fast gate in CI and the thing the editor draws, and both said a file was
  fine while the run refused it.

  Two codes only expansion could raise. Both are now reported without running a
  decorator body, which matters because the editor would otherwise execute plugin
  code on every keystroke:

  - **`VN2013`**, a decorator nothing provides, is a name lookup. It suggests the
    nearest decorator in reach, and a `pub deco` imported from another file counts
    as in reach.
  - **`VN2017`**, a verb the handle does not have, reads a table. What each kind
    answers to is known before anything runs, so `target.wobble` is refused where
    it is written.

  A test holds the relation, so a code cannot be added to one path only.

  `DecoratorSource` gains `names()`: a source that can say whether it has one can
  say which it has, and both questions have the same asker.

- [#188](https://github.com/venn-lang/venn/pull/188) [`12ad85f`](https://github.com/venn-lang/venn/commit/12ad85ff5b9b1c2bdf19735fa02cdabb0dc5e868) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `VN2019`: an import whose path leads nowhere says so, at the import.

  ```venn
  import * as cart from "./lib/cart"   # the file is ./lib/cart.vn
  ```

  ```
  VN2019 · Nothing to import from "./lib/cart".
    at    main.vn:1:1
    help  Nothing was read at /app/lib/cart.
  ```

  It used to say nothing at all. The namespace read as empty, every name off it
  was absent, and the failure surfaced wherever it was used, blaming that. The
  checker's own contribution was worse than silence: `VN3010 · Type {} has no
field "rate"`, which sends a reader to the field rather than to the path.

  Two halves. The walk records what it tried and could not read, because only the
  walk knows: whoever holds the graph afterwards sees an absent module and cannot
  tell "not there" from "not looked at". And a namespace whose module was never
  reached is now typed as unknown rather than as an empty shape, so nothing after
  the import says it again, differently and wrongly.

  That second half also removes an editor false positive: a neighbour the
  workspace had not indexed yet was typed as empty, so every use of it was drawn
  as a field error until the index caught up.

- [#307](https://github.com/venn-lang/venn/pull/307) [`ea9ca4e`](https://github.com/venn-lang/venn/commit/ea9ca4e4839cbdb78317d2b974d990e9e8808a9d) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A failure keeps its code, its place and its help from where it was raised to
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
  `` A decorator takes its argument in brackets: write `@timeout(50ms)`. `` Token
  names are translated (`ID` is a name, `':'` is a colon), and a property test over
  the bad-source corpus holds every title to one line and a length.

  The editor was the surface this reached last: Langium's own validator published
  `parserErrors` verbatim with no code at all, so the whole essay went to the
  margin. It runs the same front end the CLI does now, and
  `same-as-the-cli.test.ts` covers the parse path it never covered.

  Six more defects went with it. `REMOVED` was a plain object, so `flow "x"
constructor` reported `VN5001 · function Object() { [native code] }` and a real
  syntax error was replaced by a lint one. `bracketTheArgument` advised on lines
  that are not calls, offering `` Write `let (in= 1)`. `` for `let in = 1`.
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

- [#292](https://github.com/venn-lang/venn/pull/292) [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One front end, so a pass added once reaches every command.

  Parse-and-check was assembled by hand in three places, each choosing its own
  subset of the passes. `venn run` and `venn test` never type-checked, so this ran
  clean and printed `seven`:

  ```venn
  const count: number = "seven"
  print count
  ```

  `venn check` refused it. Both refuse it now, and so does `venn build` and so
  does the editor, because all four call the same `createFrontEnd({ plugins, caps
}).analyze(…)` in `@venn-lang/runtime`. What a command decides is still its own:
  `venn run` reports errors only, `venn check` prints hints and exits 0, the editor
  draws each at the severity the catalogue declared. Which passes ran is no longer
  a choice anybody makes.

  What that closes on the way past:

  - an error inside `${…}` is reported at the `${…}`. Every one used to land at
    line 1, column 30, whatever the file said, because a placeholder is parsed as
    its own little document and three copies of "where is this node" answered from
    its offsets.
  - a name nothing binds inside `${…}` is the same `VN2018` it is outside one.
    `expect "id=${noSuchName}" == "id="` used to pass.
  - the editor reports `VN2009` for a name a package does not publish, with the
    note that says what to write instead; keeps the severity the catalogue
    declared, so an unused import is a hint and not a red line; carries the other
    place a problem is about, which a client renders as a jump; and types a value a
    plugin publishes.
  - `print` inside a flow reaches stdout under `venn test`. There is no console in
    `stdlibPortBindings` any more, so a host that forgets to bind one hears
    `VN7002` instead of writing into a buffer nobody drains.
  - one answer to what a project declares, dotenv files included, shared by every
    command. A token kept out of the repository used to fail the check and run
    fine.
  - a file inside a workspace member reads what its root declared. The editor took
    the first `venn.toml` it found and used it verbatim, so every root-declared
    `env.*` was a red squiggle and every `#alias` pointed nowhere.
  - `pub const`, `pub type`, `pub namespace` and `pub import` can be completed
    inside `import { }`, which only `pub fn`, `pub fragment` and `pub deco` could.
  - `venn build` exits by the rule `venn check` exits by: a hint is not a failure.

- [#298](https://github.com/venn-lang/venn/pull/298) [`76fe630`](https://github.com/venn-lang/venn/commit/76fe6301b9796accfceb187ae6901cc563f0fec6) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A line means the same inside a `fn` as it does outside one.

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

- [#302](https://github.com/venn-lang/venn/pull/302) [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `@timeout`, `race`, `parallel` and `forEach` cancel by one mechanism, and what
  they cancel actually stops.

  ```venn
  flow "timeout" {
    @timeout(150ms)
    step "runaway" {
      loop n = 0 { wait 20ms; log "pass ${n}"; continue n + 1 }
    }
  }
  ```

  That program used to report a verdict at 155ms and then keep logging for ever:
  the process had to be killed. It now fails at 155ms and leaves at 424ms, with
  nothing emitted after `run.finished`.

  Nothing threaded a signal. `Engine.signal` was written by `race` and `parallel`
  and replaced by spread at each nesting level, so an outer `race` could not reach
  a `parallel` inside its own loser: same request, same race, one level deeper,
  and the loser reported passed half a second after the run had finished.
  `@timeout` wrote no signal at all, `Clock.sleep` took none, and `runPool` shared
  a cursor nothing could stop, so a pool whose failure had already been caught and
  reported kept dispatching.

  There is now one cancellation scope per `@timeout`, `race` and `parallel`, built
  under the one already running. It carries the abort and the deadline together,
  and every boundary reads it: the statement walker, both loop back edges, the
  pool's cursor, `Clock.sleep`, and the `ctx.signal` an action is handed. A scope
  that has been called off waits for what it cancelled to stop before a verdict is
  reported, which is also what stops `@lock` handing the mutex to a second holder
  while the first is still writing, and `@retry` starting an attempt while the
  last one is still running.

  The parent's end is forwarded into a plain controller rather than composed with
  `AbortSignal.any`, whose `.aborted` measured 50.8ns against 3.0ns for a plain
  signal and grew with the nesting. At the boundary: 3.17ns before, 3.26ns with no
  scope, 3.61ns inside one, 4.50ns when the scope carries a deadline, which is
  read from the clock once every 64 boundaries. A two million pass loop is
  unchanged.

  A loop written inside a `fn` is reached too. That body is compiled into thunks
  and runs synchronously, so there is no scheduler between two passes and no
  scope it could ask; `@timeout` around the step that called it did nothing, and
  the process had to be killed. The runtime now leaves the question at the one
  place the compiler can read it, and every compiled `loop`, `forEach` and
  `repeat` asks it once per pass. Five million passes take 82.5ms with nothing
  in force and 96.0ms under a `@timeout`, which is 2.7ns a pass for being able to
  stop.

  A `finally { … }` runs when the scope it is in was called off, which is the case
  it is written for and the one it did not survive: the walk refuses to take a step
  under an ended scope, and the block's first statement was that step, so a
  cancelled `try` gave nothing back. It runs detached now, as `defer` already did.

  A step that overran without ever yielding is reported. The deadline is sampled
  at boundaries and a body with fewer than sixty-four of them passed none, while
  the timer that would have said so never got a turn either: the step ran five
  times its `@timeout` and reported as having passed. The deadline is now read
  once, straight, when the body settles.

  **Where cancellation stops, said rather than left to a stopwatch.** A `fn` that
  recurses has no back edge to read the deadline at, and an action that ignores
  its `ctx.signal` cannot be stopped by anyone. Both are given a bounded while and
  then reported as `VN8002` naming what is still running. That grace runs from
  where the work was called off rather than from where it started, so a `@timeout`
  longer than the grace is enforced rather than given up on.

  `Clock.sleep(ms, signal)` ends early when the signal aborts and the real clock
  drops its timer, so a cancelled wait does not hold the process open. The
  contract version goes to 2 and the conformance suite covers it.

  Three things that were silent now say something. An empty `race { }` settles
  instead of deleting the rest of the run while exiting 0, and `VN4001` reports it
  before anything runs. A `defer` that fails no longer strands the ones behind it
  nor replaces the failure that started the unwind: all four cleanup runners go
  through one policy and report each failure as `VN7004`. And the options of
  `parallel`, `race` and `forEach` are held to what they declare, so
  `onError: "collct"` is refused rather than read as the opposite of the default,
  `race { timeout: … }` is finally honoured, and `venn.toml` reports as `VN2109` a
  table nothing reads.

- [#216](https://github.com/venn-lang/venn/pull/216) [`1ac5629`](https://github.com/venn-lang/venn/commit/1ac56293b18b67f607949a0784e02b7fe28c8b8f) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The lint family has six codes, and had one.

  Each of these runs and does something other than what it looks like. None is a
  syntax error and none is a type error, which is why nobody was saying anything.

  | Code     | Written               | What happened                                     |
  | -------- | --------------------- | ------------------------------------------------- |
  | `VN5002` | `print { a: 1 }`      | prints an empty line: the trailing map is options |
  | `VN5002` | `print match x { … }` | prints an empty line: that is two statements      |
  | `VN5003` | `{ a: 1, a: 2 }`      | the second wins, in silence                       |
  | `VN5004` | `on banana { … }`     | an event nothing fires, so a block nothing runs   |
  | `VN5005` | an import nobody used | a hint, since it is untidy and not wrong          |

  `VN5001` reaches both words it is for. `capture` was parsed inside a flow and a
  parse error at the top of a file, where a program has its bindings; `while` had
  no rule at all, so it was `Expecting token of type 'EOF' but found 'while'`
  wherever it was written. Both now say what became of the word and what to write.

  An error is reported before a hint, and `venn check` no longer fails on a hint
  alone.

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

- [#310](https://github.com/venn-lang/venn/pull/310) [`39e3fa0`](https://github.com/venn-lang/venn/commit/39e3fa08896dafd53389cadd18cecab392168063) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The tail of v0.6: two shapes the specification documented and the runtime
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
  Every problem now travels the failure channel epic [#287](https://github.com/venn-lang/venn/issues/287) built, and `run.finished`
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

- [#206](https://github.com/venn-lang/venn/pull/206) [`897350a`](https://github.com/venn-lang/venn/commit/897350ac4ca0334854c6338fd3449a515a15a805) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `??`, `||` and `&&` do what they promise.

  ```venn
  const name: string = user.name ?? "anon"
  const shown: string = user.name || "anon"
  ```

  Three things, all found by running the operators rather than reading them.

  **A left side that had not arrived broke all three.** A promise is neither
  nothing nor false, so each decided against the promise itself: `slow() ?? 8080`
  handed back the promise it was asked to replace, and `slow() && f()` ran `f`
  however the left side turned out. They now wait, the way every other node does.

  **The type kept the null the operator exists to remove.** `(string | null) ??
string` was `string | null`, and where the two sides disagreed the answer was
  `dynamic`. `??` and `||` hand over the right side in exactly the case where the
  left was nothing, so nothing cannot come out of either. `&&` is the other way
  round, since the falsy left is what it gives back.

  **`&&` and `||` were typed `bool`** while handing back an operand, so
  `const name: string = user.name || "anon"` was refused although it runs.

  Mixing `??` with `||` or `&&` without brackets is now refused as `VN1003`.
  `a || b ?? c` and `a ?? b || c` answer differently and nothing in the line says
  which reading is which, so the order is written:

  ```venn
  const x = (a || b) ?? c
  const y = a || (b ?? c)
  ```

  A `try` where an argument goes now says what to write, instead of reporting that
  a `{` was expected.

### Patch Changes

- [#203](https://github.com/venn-lang/venn/pull/203) [`8276c5c`](https://github.com/venn-lang/venn/commit/8276c5cefed70c9efce52122880703c72ff5af3a) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `try` can produce a value.

  ```venn
  const port = try json.parse(raw).port else 8080
  const why = try http.get(url) catch e => e.message
  ```

  The block form recovers where steps run, so "try this, and if it fails use that"
  could only be written by binding before the `try` and assigning inside it, and
  inside a `fn` body it could not be written at all.

  `else` gives the value to stand in with; `catch e =>` gives the same, with the
  failure bound to a name. What it binds has a `message` and a `code`. The two
  forms split on the same line as the rest of the language: `{ … }` runs steps,
  `=>` gives a value.

  Only a failure is caught. A `break`, a `return` or an `exit` is the program going
  where it was told, and catching one would turn a loop's `break` into a fallback.

  There is no bare `try` without `else` or `catch`: `try f() else null` says what it
  does, and an attempt whose fallback nobody wrote is a failure nobody handled.

  The failure a `catch` binds now carries the code it was raised with. Both forms
  read it from one place, and the one they replace read it from the wrong field, so
  every failure the compiler raised came back as `VN7000`.

- [#209](https://github.com/venn-lang/venn/pull/209) [`053ec1e`](https://github.com/venn-lang/venn/commit/053ec1e74a26e20e4507a572e73d8b074fc0bc40) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A fragment reads the file it was written in.

  ```venn
  const limit = 7

  fragment show() {
    print limit          # was null, is 7
  }
  run show()
  ```

  Its scope was built from nothing, so the file's bindings were one link away and
  out of reach, while a `fn` written beside it read them fine. Nothing caught it:
  the name is bound in the file, so the check that asks about unbound names was
  right to stay quiet, and what surfaced was an operator refusing two values a
  line later.

  A fragment belongs to its file the way a `fn` does. Its parameters and whatever
  it binds still die with the call, and a caller's locals are still out of reach,
  because the scope it gets is a child of the file and never of the caller. One
  imported from elsewhere reads its own file, not the caller's.

  Assigning one of the file's bindings from inside a fragment now writes the
  file's binding.

- [#293](https://github.com/venn-lang/venn/pull/293) [`461548d`](https://github.com/venn-lang/venn/commit/461548d9da1e1beb0d2c89bf4399c96597b1d58f) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The charter's rules are checked by something that runs, and the manifests say what the code uses.

  `createRunner` is the runtime's entry point and showed nothing on hover: two
  JSDoc blocks were stacked with nothing between them, so both bound to the
  private helper underneath and the documented one was never the documented one.

  Four workspace dependencies were declared and never imported, `@venn-lang/cli`
  on `assert` and on `io`, `@venn-lang/core` on `contracts`, `@venn-lang/mock` on
  `contracts`, and two more were production dependencies of `@venn-lang/stdlib`
  that only its tests reach. None of them appears in any built bundle, so nothing
  that installs these packages resolves less than it did.

  Thirteen folders that hold TypeScript now publish a barrel, `cli/src/run` above
  all, which fourteen files' worth of commands had been reaching into by name.

- Updated dependencies [[`0d954e6`](https://github.com/venn-lang/venn/commit/0d954e6a0f6b49af3ca8a899e9a236f960a54129), [`7dc995e`](https://github.com/venn-lang/venn/commit/7dc995e0ee9d9abbfea07c1d661a81f5f47c9b9d), [`380d7a7`](https://github.com/venn-lang/venn/commit/380d7a7550dd17c898914ec9eb943be6d157f954), [`7bf0457`](https://github.com/venn-lang/venn/commit/7bf04571a7fa27279936444c9acbbe417cbf4e41), [`e3d4da6`](https://github.com/venn-lang/venn/commit/e3d4da6053291a6874147b457f6b68a96539313b), [`9da628a`](https://github.com/venn-lang/venn/commit/9da628a02c36ad3d3c194e6cafee8ce486c432b7), [`8276c5c`](https://github.com/venn-lang/venn/commit/8276c5cefed70c9efce52122880703c72ff5af3a), [`8fcf804`](https://github.com/venn-lang/venn/commit/8fcf804d597e0cc9842e06da2be8a76543c6d7fb), [`8e9cbd9`](https://github.com/venn-lang/venn/commit/8e9cbd98e623c98f95bb28386a75c4905d35c499), [`e3a4ce2`](https://github.com/venn-lang/venn/commit/e3a4ce26917771043642383e1081a06006a802f5), [`210aaf1`](https://github.com/venn-lang/venn/commit/210aaf15035b53f85d114d627614adcd8e279c23), [`88d87d2`](https://github.com/venn-lang/venn/commit/88d87d215cfde723821e73832fbef2e03dff3c52), [`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`f5e4bd2`](https://github.com/venn-lang/venn/commit/f5e4bd2a0bcb7a22f4cba465d2d9b8be21605249), [`9c4b430`](https://github.com/venn-lang/venn/commit/9c4b4303e41e10b006aac8ef0919b30f3800b57e), [`43412e3`](https://github.com/venn-lang/venn/commit/43412e36a5865cc2838eab1b85352f4a1ff359e3), [`1d9bbbc`](https://github.com/venn-lang/venn/commit/1d9bbbc3586f9a429ed0837a343fb85e3b2cd72e), [`27b3667`](https://github.com/venn-lang/venn/commit/27b3667838788859800928d540991053f63051e4), [`9918c2d`](https://github.com/venn-lang/venn/commit/9918c2d36ecec2d9f18a60997bcc50806a71ba23), [`952f337`](https://github.com/venn-lang/venn/commit/952f33752893da86783d8945f838cfadc8db87d3), [`de91a07`](https://github.com/venn-lang/venn/commit/de91a079d57de204f2522579239103503ba7aeab), [`229e228`](https://github.com/venn-lang/venn/commit/229e228653c341db956da0df8df10fbaae2babe3), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`6a01684`](https://github.com/venn-lang/venn/commit/6a016840bf5eb819d8578be29dff18b81bb8dfba), [`1d940c8`](https://github.com/venn-lang/venn/commit/1d940c87e2ec3c60856d0e635f7d32658f9b2cd3), [`1411452`](https://github.com/venn-lang/venn/commit/141145211d7797116ecf753226a3781ea2c664e6), [`badc427`](https://github.com/venn-lang/venn/commit/badc427fe1b08fab0b3deed5ff82e2ee1170ae2e), [`461548d`](https://github.com/venn-lang/venn/commit/461548d9da1e1beb0d2c89bf4399c96597b1d58f), [`12ad85f`](https://github.com/venn-lang/venn/commit/12ad85ff5b9b1c2bdf19735fa02cdabb0dc5e868), [`ea9ca4e`](https://github.com/venn-lang/venn/commit/ea9ca4e4839cbdb78317d2b974d990e9e8808a9d), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`85af966`](https://github.com/venn-lang/venn/commit/85af966355e43cde5f836651128e0582ec534543), [`76fe630`](https://github.com/venn-lang/venn/commit/76fe6301b9796accfceb187ae6901cc563f0fec6), [`e15f93e`](https://github.com/venn-lang/venn/commit/e15f93e53d7d09a50b5a87a68f30d4bdd703f7db), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e), [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa), [`694507b`](https://github.com/venn-lang/venn/commit/694507b6d7c7c776cf019dac8a42e03ae5000a46), [`50ba370`](https://github.com/venn-lang/venn/commit/50ba3709e023485f867bae18255cbfe0f3510149), [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`5170702`](https://github.com/venn-lang/venn/commit/517070288ad89f3f1c0657a7139ae1474941ee25), [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4), [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644), [`4579364`](https://github.com/venn-lang/venn/commit/45793647baae3cbb64596cc502d3f312e3cd4f2d), [`1ac5629`](https://github.com/venn-lang/venn/commit/1ac56293b18b67f607949a0784e02b7fe28c8b8f), [`bd1dca2`](https://github.com/venn-lang/venn/commit/bd1dca2971a53642eb6d74a17334d0f8cef7f275), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e), [`39e3fa0`](https://github.com/venn-lang/venn/commit/39e3fa08896dafd53389cadd18cecab392168063), [`54243fe`](https://github.com/venn-lang/venn/commit/54243fed3a18c91ad57e6b9aa878d66510c6be6a), [`40ea17f`](https://github.com/venn-lang/venn/commit/40ea17f032320da70849e048f4a3381df858ffac), [`18ced18`](https://github.com/venn-lang/venn/commit/18ced18e272d5e15e8972751a87c6c88598ed951), [`34d1b24`](https://github.com/venn-lang/venn/commit/34d1b2410346f8cd211bc83a2bc42cede15c5c96), [`897350a`](https://github.com/venn-lang/venn/commit/897350ac4ca0334854c6338fd3449a515a15a805)]:
  - @venn-lang/core@0.7.0
  - @venn-lang/prelude@0.7.0
  - @venn-lang/contracts@0.7.0
  - @venn-lang/sdk@0.7.0
  - @venn-lang/types@0.7.0

## 0.6.0

### Minor Changes

- [#141](https://github.com/venn-lang/venn/pull/141) [`3534c4c`](https://github.com/venn-lang/venn/commit/3534c4c3fbc4c9cafe69798290add826098e0ba6) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - **This breaks every file that says `use`.** Before 1.0 a break rides a minor
  bump, which is the 0.x convention; the version to read it by is the changelog,
  not the number.

  Remove `use`, and bring everything in by name.

  ```venn
  import { http } from "venn/http"
  import { expect } from "venn/assert"
  ```

  One keyword brings a namespace, a verb, a matcher, a type or a value into a
  file, and nothing arrives unasked except the prelude. `use` parsed a whole
  package in and left the file quiet about what it actually took, which is the
  difference between reading an import and guessing one.

- [#150](https://github.com/venn-lang/venn/pull/150) [`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The constants and functions a number has no member for.

- [#153](https://github.com/venn-lang/venn/pull/153) [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Join a path, take one apart, ask where it leads.

### Patch Changes

- Updated dependencies [[`3534c4c`](https://github.com/venn-lang/venn/commit/3534c4c3fbc4c9cafe69798290add826098e0ba6), [`b126f71`](https://github.com/venn-lang/venn/commit/b126f712fcf7fb2229bd1af2888d440a7793c189), [`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/core@0.6.0
  - @venn-lang/prelude@0.6.0
  - @venn-lang/contracts@0.6.0
  - @venn-lang/sdk@0.6.0
  - @venn-lang/types@0.6.0

## 0.5.0

### Minor Changes

- [#131](https://github.com/venn-lang/venn/pull/131) [`4d59574`](https://github.com/venn-lang/venn/commit/4d59574ab379a127b81119a8d2b0b032605ab249) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Take a value apart where it is bound.

- [#136](https://github.com/venn-lang/venn/pull/136) [`6ad7352`](https://github.com/venn-lang/venn/commit/6ad7352424bb745e0bde9a2ec8e7af2e34320c63) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a match arm ask for more than the shape.

- [#137](https://github.com/venn-lang/venn/pull/137) [`80fe6bd`](https://github.com/venn-lang/venn/commit/80fe6bd5099d04a2a57779583ec6c7070b2fec46) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a match arm be reached more than one way.

- [#132](https://github.com/venn-lang/venn/pull/132) [`9e97e7c`](https://github.com/venn-lang/venn/commit/9e97e7c4f68f53e9dfcd32aa2175e9f89942b952) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Decide between shapes with every case accounted for.

- [#138](https://github.com/venn-lang/venn/pull/138) [`2246faa`](https://github.com/venn-lang/venn/commit/2246faa06276fafbcb4e67b2a7acefe2cbe39eb5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a pattern take what is left.

- [#140](https://github.com/venn-lang/venn/pull/140) [`fee4e1a`](https://github.com/venn-lang/venn/commit/fee4e1a0a0a2f6b74205b9e617db472fd1e23a28) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Pour a list into a list and a map into a map.

### Patch Changes

- Updated dependencies [[`4d59574`](https://github.com/venn-lang/venn/commit/4d59574ab379a127b81119a8d2b0b032605ab249), [`6ad7352`](https://github.com/venn-lang/venn/commit/6ad7352424bb745e0bde9a2ec8e7af2e34320c63), [`da8f14f`](https://github.com/venn-lang/venn/commit/da8f14f3c98cdb4560dbf34522108f5eb7bef1ba), [`80fe6bd`](https://github.com/venn-lang/venn/commit/80fe6bd5099d04a2a57779583ec6c7070b2fec46), [`9e97e7c`](https://github.com/venn-lang/venn/commit/9e97e7c4f68f53e9dfcd32aa2175e9f89942b952), [`2246faa`](https://github.com/venn-lang/venn/commit/2246faa06276fafbcb4e67b2a7acefe2cbe39eb5), [`fee4e1a`](https://github.com/venn-lang/venn/commit/fee4e1a0a0a2f6b74205b9e617db472fd1e23a28)]:
  - @venn-lang/core@0.5.0
  - @venn-lang/contracts@0.5.0
  - @venn-lang/sdk@0.5.0
  - @venn-lang/types@0.5.0

## 0.4.0

### Minor Changes

- [#126](https://github.com/venn-lang/venn/pull/126) [`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a signature be polymorphic.

### Patch Changes

- Updated dependencies [[`5fc1774`](https://github.com/venn-lang/venn/commit/5fc17743005962cbc420580fd292a0ee31e5b291), [`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10), [`17b6fdb`](https://github.com/venn-lang/venn/commit/17b6fdbecbe4f567b750f58eb3f3ffef5448f1df), [`7a21703`](https://github.com/venn-lang/venn/commit/7a21703916428e1d32a1ad2757820d493fbc03c4), [`d05eb04`](https://github.com/venn-lang/venn/commit/d05eb04c415f3dd090e883a1909618ea00e782a6)]:
  - @venn-lang/core@0.4.0
  - @venn-lang/types@0.4.0
  - @venn-lang/sdk@0.4.0
  - @venn-lang/contracts@0.4.0

## 0.3.0

### Minor Changes

- [#121](https://github.com/venn-lang/venn/pull/121) [`a8ad8b2`](https://github.com/venn-lang/venn/commit/a8ad8b205b257e9c57022b52ae3d20780b5a452a) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - One loop for every end that is not known in advance.

- [#120](https://github.com/venn-lang/venn/pull/120) [`03f7331`](https://github.com/venn-lang/venn/commit/03f73316ef5e2517dc0ca0085340bf684c4f0aa0) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Let a file publish a type and a constant.

### Patch Changes

- [#110](https://github.com/venn-lang/venn/pull/110) [`adb36ab`](https://github.com/venn-lang/venn/commit/adb36abf8cc2026eac6fd4cf56b079c660a2a6ec) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Fill the placeholders in a step title.

- Updated dependencies [[`a8ad8b2`](https://github.com/venn-lang/venn/commit/a8ad8b205b257e9c57022b52ae3d20780b5a452a), [`03f7331`](https://github.com/venn-lang/venn/commit/03f73316ef5e2517dc0ca0085340bf684c4f0aa0), [`5fd9dc5`](https://github.com/venn-lang/venn/commit/5fd9dc5712065d8046de2c5621f4a7aa263536ac), [`badce1b`](https://github.com/venn-lang/venn/commit/badce1b8073274554ecc6d7b3033eb6daad2665b), [`f6016f3`](https://github.com/venn-lang/venn/commit/f6016f39dea8fb4d1b64bbb5163e6aedd7bac1ab), [`873c398`](https://github.com/venn-lang/venn/commit/873c39842b9d3b6095286d8dc08cb7862d19f2d5), [`adb36ab`](https://github.com/venn-lang/venn/commit/adb36abf8cc2026eac6fd4cf56b079c660a2a6ec), [`0735ab6`](https://github.com/venn-lang/venn/commit/0735ab6d7856672c3b300ec825de404ec20c4945)]:
  - @venn-lang/core@0.3.0
  - @venn-lang/contracts@0.3.0
  - @venn-lang/sdk@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.2.0
  - @venn-lang/core@0.2.0
  - @venn-lang/sdk@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`cd42016`](https://github.com/venn-lang/venn/commit/cd420167006ad0ac34dc57dd7a6676516e1ca97d)]:
  - @venn-lang/contracts@0.1.3
  - @venn-lang/core@0.1.3
  - @venn-lang/sdk@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [[`906eb82`](https://github.com/venn-lang/venn/commit/906eb826eb0130f198d52ffa03903be54eacfd89)]:
  - @venn-lang/contracts@0.1.2
  - @venn-lang/core@0.1.2
  - @venn-lang/sdk@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.1
  - @venn-lang/core@0.1.1
  - @venn-lang/sdk@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.0
  - @venn-lang/core@0.1.0
  - @venn-lang/sdk@0.1.0
  - @venn-lang/types@0.1.0
