# @venn-lang/cli

## 0.8.0

### Patch Changes

- Updated dependencies [[`15abec4`](https://github.com/venn-lang/venn/commit/15abec452e2d1135e3885a09a5fbbc2b4b323584), [`5815eb1`](https://github.com/venn-lang/venn/commit/5815eb182b2fb02c388db7481320e40b89c5bdff)]:
  - @venn-lang/core@0.8.0
  - @venn-lang/lsp@0.8.0
  - @venn-lang/runtime@0.8.0
  - @venn-lang/stdlib@0.8.0
  - @venn-lang/contracts@0.8.0
  - @venn-lang/dts@0.8.0
  - @venn-lang/project@0.8.0
  - @venn-lang/sdk@0.8.0
  - @venn-lang/http@0.8.0
  - @venn-lang/types@0.8.0

## 0.7.5

### Patch Changes

- Updated dependencies [[`a6b6ded`](https://github.com/venn-lang/venn/commit/a6b6dedc1c204930cf27e07520e732c6ecebc9c5)]:
  - @venn-lang/core@0.7.5
  - @venn-lang/runtime@0.7.5
  - @venn-lang/lsp@0.7.5
  - @venn-lang/stdlib@0.7.5
  - @venn-lang/contracts@0.7.5
  - @venn-lang/dts@0.7.5
  - @venn-lang/project@0.7.5
  - @venn-lang/sdk@0.7.5
  - @venn-lang/http@0.7.5
  - @venn-lang/types@0.7.5

## 0.7.4

### Patch Changes

- Updated dependencies [[`ad82b9c`](https://github.com/venn-lang/venn/commit/ad82b9c8611932146b802d68aeded0fd4afd7fa2)]:
  - @venn-lang/lsp@0.7.4
  - @venn-lang/contracts@0.7.4
  - @venn-lang/core@0.7.4
  - @venn-lang/dts@0.7.4
  - @venn-lang/project@0.7.4
  - @venn-lang/runtime@0.7.4
  - @venn-lang/sdk@0.7.4
  - @venn-lang/http@0.7.4
  - @venn-lang/stdlib@0.7.4
  - @venn-lang/types@0.7.4

## 0.7.3

### Patch Changes

- Updated dependencies [[`ea73ed7`](https://github.com/venn-lang/venn/commit/ea73ed7dd1cc3c68797fcde4459677b45c41ac67)]:
  - @venn-lang/core@0.7.3
  - @venn-lang/lsp@0.7.3
  - @venn-lang/runtime@0.7.3
  - @venn-lang/stdlib@0.7.3
  - @venn-lang/contracts@0.7.3
  - @venn-lang/dts@0.7.3
  - @venn-lang/project@0.7.3
  - @venn-lang/sdk@0.7.3
  - @venn-lang/http@0.7.3
  - @venn-lang/types@0.7.3

## 0.7.2

### Patch Changes

- Updated dependencies [[`6459278`](https://github.com/venn-lang/venn/commit/6459278d5687ac55f893203780ee4f06acf42a95)]:
  - @venn-lang/lsp@0.7.2
  - @venn-lang/contracts@0.7.2
  - @venn-lang/core@0.7.2
  - @venn-lang/dts@0.7.2
  - @venn-lang/project@0.7.2
  - @venn-lang/runtime@0.7.2
  - @venn-lang/sdk@0.7.2
  - @venn-lang/http@0.7.2
  - @venn-lang/stdlib@0.7.2
  - @venn-lang/types@0.7.2

## 0.7.1

### Patch Changes

- [#314](https://github.com/venn-lang/venn/pull/314) [`940d682`](https://github.com/venn-lang/venn/commit/940d682aeddde0d9caa195f99bb9d4a395bd19f2) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `pnpm vscode:install` works again.

  The documented way to install the editor extension refused to run:

  ```
  ERROR  @types/vscode 1.125.0 greater than engines.vscode ^1.90.0.
  Either upgrade engines.vscode or use an older @types/vscode version
  ```

  `vsce` will not package an extension typed against an editor newer than the one
  its `engines` claims to support, and the rule is right: the types have to
  describe the **oldest** editor the extension runs on, or it can be written
  against an API that version does not have and the failure lands on somebody
  else's machine.

  So the types came down to `1.90.0` rather than the engine going up. The
  extension uses four APIs, `window.createOutputChannel`,
  `workspace.createFileSystemWatcher`, `workspace.onDidChangeWorkspaceFolders` and
  `workspace.workspaceFolders`, all of them older than 1.90, which `tsc` confirms
  rather than a reading of the source.

  A test pins the two together. It is in the package rather than in the packaging
  step, because that step only runs when somebody is already trying to install.

- Updated dependencies [[`c619846`](https://github.com/venn-lang/venn/commit/c6198462bd3ce373b8f6bd1f5ab045f4e97fe6a5)]:
  - @venn-lang/lsp@0.7.1
  - @venn-lang/contracts@0.7.1
  - @venn-lang/core@0.7.1
  - @venn-lang/dts@0.7.1
  - @venn-lang/project@0.7.1
  - @venn-lang/runtime@0.7.1
  - @venn-lang/sdk@0.7.1
  - @venn-lang/http@0.7.1
  - @venn-lang/stdlib@0.7.1
  - @venn-lang/types@0.7.1

## 0.7.0

### Minor Changes

- [#198](https://github.com/venn-lang/venn/pull/198) [`e3a4ce2`](https://github.com/venn-lang/venn/commit/e3a4ce26917771043642383e1081a06006a802f5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A folder is a module when it has a `mod.vn`.

  ```venn
  # shop/mod.vn
  pub import { withTax } from "./prices.vn"
  pub import * as coupon from "./coupon"
  ```

  ```venn
  import * as shop from "./shop"

  shop.withTax(100)
  shop.coupon.apply(100, "black")
  ```

  **An extension names a file. No extension names a folder.**

  | Written       | Read                      |
  | ------------- | ------------------------- |
  | `"./cart.vn"` | that file                 |
  | `"./cart"`    | `./cart/mod.vn`           |
  | `"#lib/cart"` | `<paths.lib>/cart/mod.vn` |

  No cascade: never "try `.vn`, then `/mod.vn`, then `/index.vn`". Whoever reads
  the import knows from the string alone which of the two it meant, and there is
  no resolution order to learn or to get wrong.

  Before this, a library of ten files made its callers learn all ten paths. What
  `mod.vn` hands on is the folder's interface, and what it does not is the
  folder's business, which can be moved without a caller noticing.

  A folder with no `mod.vn` is not a module, and the import that named one says
  which file it looked for.

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

- [#249](https://github.com/venn-lang/venn/pull/249) [`4576498`](https://github.com/venn-lang/venn/commit/4576498230c05a82c66de6927e77a659fdd5b639) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `venn run` reads the lints too.

  The document check ran under `venn check` and in the editor, and not under
  `venn run`, so a lint was something you only met if you happened to ask twice.
  `print { a: 1 }` was the worst of it: the check said the map had been swallowed
  as an options block, and the run printed an empty line and said nothing.

  Errors stop a run and are reported. A run already stops for a parse error and for
  an import that names nothing, and a lint error is the same thing said later: a
  line that cannot mean what it says. A warning or a hint stays `venn check`'s
  business, because printing one on every run would teach people to stop reading
  them.

  It found two files in this repository on the first day, both importing a name
  they did not use and using two they had not imported.

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

- [#186](https://github.com/venn-lang/venn/pull/186) [`8895936`](https://github.com/venn-lang/venn/commit/8895936f5ca26dae393d041392318141bdbcc747) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The rest of what an error knows now reaches the person reading it.

  ```
  VN2018 · Nothing is named "descnto" here.
    at    cart.vn:2:12
    help  Did you mean `desconto`?
  ```

  §16 says a well-formed error answers seven questions. Two arrived. `help`,
  `note`, `related` and `docs` were built by the checks and dropped by the
  renderer:

  ```ts
  process.stderr.write(`${problem.code} · ${problem.title}\n`);
  process.stderr.write(`  at ${uri}:${line}:${column}\n`);
  ```

  Eighteen places in the checker fill one of those fields. `VN2007` says which
  import to write, `VN3013` says to use `run`, `VN2018` and `VN2003` name the
  verb or the binding that was nearly right, and none of it was shown.

  One renderer now, so `venn check`, `venn run` and `venn test` read the same
  beneath their own headings, and the editor carries the help into the diagnostic
  it publishes rather than only the title.

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

- [#292](https://github.com/venn-lang/venn/pull/292) [`8c683c5`](https://github.com/venn-lang/venn/commit/8c683c5e7bdfa1f2141ef741ec73ef50619d6054) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - `venn test` leaves the report to the reporter, and a run reads what the packages published.

  Two things the epic's own point had not reached. A program's `print` under
  `venn test` went to standard output, which is where the NDJSON envelopes and the
  JUnit prolog go, so the default piped run emitted a line nobody could parse and
  `--reporter junit` emitted text before the XML declaration. It goes to standard
  error now: both streams reach the same terminal, so a person still sees it, and
  a pipe gets a clean report.

  And `runFile` hardcoded an empty map of package types while `venn check` read
  them from `target/types/`, so the same type check ran over a knowingly smaller
  world under `run`. `packageTypesFor` has one definition now and both commands
  call it, which is the epic in miniature.

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

### Patch Changes

- [#313](https://github.com/venn-lang/venn/pull/313) [`a26ad24`](https://github.com/venn-lang/venn/commit/a26ad243f105a09c3528c4c403348d92d598d2c8) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The release notes fit the page GitHub gives them.

  `scripts/release-notes.mjs` folds each entry's prose into a `<details>` block, and
  nothing bounded the total. GitHub refuses a release body over 125000 characters
  with a 422, and the step that creates the release runs **after**
  `changeset publish`, so a release too large to post fails with every package
  already on npm and the version already tagged. That is the one failure in this
  workflow that running it again does not fix.

  Measured against the pending release: 67 changesets rendered **609558**
  characters, 4.9 times the limit. The size follows the prose rather than the
  number of changes, because a changeset naming ten packages writes its prose into
  ten changelogs, so 67 changesets became 175 bullets carrying 67 distinct
  sentences.

  The detail is now all-or-nothing per release rather than trimmed at an arbitrary
  entry. Every line keeps its sentence, its package, its pull request and its
  author; only the folded prose goes, and the footer says where it is, since it is
  in the changelogs either way. The same 67 changesets render at **37220**.

  A release that fits is untouched. Regenerating v0.6.0 gives 7196 characters and
  five `<details>` blocks, byte for byte what that release published.

- [#293](https://github.com/venn-lang/venn/pull/293) [`92423de`](https://github.com/venn-lang/venn/commit/92423de49fef6f13cac998fcddb85f9ba9882ede) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A package manager that installs, and a scanner that cannot be made to hang.

  `pnpm@11.13.0` was unpublished as a broken release: its `@pnpm/exe` build shipped
  without a binary, so every job began by failing to install the tool it needed.
  The pin moves to `11.20.0` and the lockfile does not change, so nothing was
  resolving differently, only refusing to start.

  The examples scanner matched a decorator line with `@\w+[^\n]*`, whose two halves
  overlap: a line of `@` and then anything can be split between them in as many
  ways as the line is long. It reads every example, which is exactly where that
  costs something. `@[^\n]+` says the same thing with one way to match it.

- [#293](https://github.com/venn-lang/venn/pull/293) [`f28cbc4`](https://github.com/venn-lang/venn/commit/f28cbc437c94b8fdaba802fab0a7855c204249f7) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - A guard nobody can walk past by editing a README.

  Markdown was classified as prose, so a pull request that touched only `.md`
  skipped every check. Three of the guards this epic adds read Markdown: one
  requires a package to have a README, one requires a Venn block in it that
  checks, and one refuses a dash or a credited tool in any file. Skipping them on
  a change to the very files they are about is a guard with a door in it.

  The neutrality guard learned both spellings of a Node module. `from "fs"` is the
  same import as `from "node:fs"` to Node and to tsdown, so a guard that only knew
  the prefixed one could be walked past by dropping four characters, and
  `@venn-lang/contracts/node` is the one subpath the charter says carries `node:*`,
  so reaching it from a neutral entry is the same leak one package along.

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

- Updated dependencies [[`0d954e6`](https://github.com/venn-lang/venn/commit/0d954e6a0f6b49af3ca8a899e9a236f960a54129), [`7dc995e`](https://github.com/venn-lang/venn/commit/7dc995e0ee9d9abbfea07c1d661a81f5f47c9b9d), [`380d7a7`](https://github.com/venn-lang/venn/commit/380d7a7550dd17c898914ec9eb943be6d157f954), [`7bf0457`](https://github.com/venn-lang/venn/commit/7bf04571a7fa27279936444c9acbbe417cbf4e41), [`e3d4da6`](https://github.com/venn-lang/venn/commit/e3d4da6053291a6874147b457f6b68a96539313b), [`9da628a`](https://github.com/venn-lang/venn/commit/9da628a02c36ad3d3c194e6cafee8ce486c432b7), [`8276c5c`](https://github.com/venn-lang/venn/commit/8276c5cefed70c9efce52122880703c72ff5af3a), [`8fcf804`](https://github.com/venn-lang/venn/commit/8fcf804d597e0cc9842e06da2be8a76543c6d7fb), [`8e9cbd9`](https://github.com/venn-lang/venn/commit/8e9cbd98e623c98f95bb28386a75c4905d35c499), [`e3a4ce2`](https://github.com/venn-lang/venn/commit/e3a4ce26917771043642383e1081a06006a802f5), [`053ec1e`](https://github.com/venn-lang/venn/commit/053ec1e74a26e20e4507a572e73d8b074fc0bc40), [`210aaf1`](https://github.com/venn-lang/venn/commit/210aaf15035b53f85d114d627614adcd8e279c23), [`88d87d2`](https://github.com/venn-lang/venn/commit/88d87d215cfde723821e73832fbef2e03dff3c52), [`d272818`](https://github.com/venn-lang/venn/commit/d272818687f122e5f6a40a3be565f0cb0e4a1910), [`f5e4bd2`](https://github.com/venn-lang/venn/commit/f5e4bd2a0bcb7a22f4cba465d2d9b8be21605249), [`9c4b430`](https://github.com/venn-lang/venn/commit/9c4b4303e41e10b006aac8ef0919b30f3800b57e), [`43412e3`](https://github.com/venn-lang/venn/commit/43412e36a5865cc2838eab1b85352f4a1ff359e3), [`750e2ab`](https://github.com/venn-lang/venn/commit/750e2ab0c635b4c92b196192ad995d1aa22f1dc4), [`1d9bbbc`](https://github.com/venn-lang/venn/commit/1d9bbbc3586f9a429ed0837a343fb85e3b2cd72e), [`27b3667`](https://github.com/venn-lang/venn/commit/27b3667838788859800928d540991053f63051e4), [`9918c2d`](https://github.com/venn-lang/venn/commit/9918c2d36ecec2d9f18a60997bcc50806a71ba23), [`952f337`](https://github.com/venn-lang/venn/commit/952f33752893da86783d8945f838cfadc8db87d3), [`fa999b7`](https://github.com/venn-lang/venn/commit/fa999b75d85bece59dbfa7fe6994a779f9230d4b), [`de91a07`](https://github.com/venn-lang/venn/commit/de91a079d57de204f2522579239103503ba7aeab), [`51d879e`](https://github.com/venn-lang/venn/commit/51d879e39b6d186f4306c42b26a995ba67a12643), [`229e228`](https://github.com/venn-lang/venn/commit/229e228653c341db956da0df8df10fbaae2babe3), [`18e17f9`](https://github.com/venn-lang/venn/commit/18e17f939db96ff45a8a2336069ffeeab75c055e), [`e321379`](https://github.com/venn-lang/venn/commit/e32137978e97bc5b2c8fb5d14af20685f46ad8b5), [`6a01684`](https://github.com/venn-lang/venn/commit/6a016840bf5eb819d8578be29dff18b81bb8dfba), [`9948d96`](https://github.com/venn-lang/venn/commit/9948d96ba4753c718115f99150fcd8938c27b7ca), [`1d940c8`](https://github.com/venn-lang/venn/commit/1d940c87e2ec3c60856d0e635f7d32658f9b2cd3), [`1411452`](https://github.com/venn-lang/venn/commit/141145211d7797116ecf753226a3781ea2c664e6), [`8895936`](https://github.com/venn-lang/venn/commit/8895936f5ca26dae393d041392318141bdbcc747), [`badc427`](https://github.com/venn-lang/venn/commit/badc427fe1b08fab0b3deed5ff82e2ee1170ae2e), [`461548d`](https://github.com/venn-lang/venn/commit/461548d9da1e1beb0d2c89bf4399c96597b1d58f), [`12ad85f`](https://github.com/venn-lang/venn/commit/12ad85ff5b9b1c2bdf19735fa02cdabb0dc5e868), [`ea9ca4e`](https://github.com/venn-lang/venn/commit/ea9ca4e4839cbdb78317d2b974d990e9e8808a9d), [`6cf0a30`](https://github.com/venn-lang/venn/commit/6cf0a303448261a11c87e57df191229e951b3098), [`85af966`](https://github.com/venn-lang/venn/commit/85af966355e43cde5f836651128e0582ec534543), [`76fe630`](https://github.com/venn-lang/venn/commit/76fe6301b9796accfceb187ae6901cc563f0fec6), [`e15f93e`](https://github.com/venn-lang/venn/commit/e15f93e53d7d09a50b5a87a68f30d4bdd703f7db), [`4c1eac1`](https://github.com/venn-lang/venn/commit/4c1eac1e18717cf39b5f7d75aa596c52f31a7457), [`902dd90`](https://github.com/venn-lang/venn/commit/902dd906f630e28a46e2ef530766d53fcf5cbe6e), [`d39bace`](https://github.com/venn-lang/venn/commit/d39bace59fb888f519f553a29e4c342db6ab0afa), [`694507b`](https://github.com/venn-lang/venn/commit/694507b6d7c7c776cf019dac8a42e03ae5000a46), [`50ba370`](https://github.com/venn-lang/venn/commit/50ba3709e023485f867bae18255cbfe0f3510149), [`aca64bc`](https://github.com/venn-lang/venn/commit/aca64bc5338e4a78e0835e44bd894a56519cff0e), [`a0fbdcc`](https://github.com/venn-lang/venn/commit/a0fbdccd7c39d81a8176218e6a0bc3c1d0885068), [`5170702`](https://github.com/venn-lang/venn/commit/517070288ad89f3f1c0657a7139ae1474941ee25), [`8d448a9`](https://github.com/venn-lang/venn/commit/8d448a992d10cacfffb09a08f44fa04e540d46b4), [`d0915ca`](https://github.com/venn-lang/venn/commit/d0915ca3b941233265e804268ff31cfffb468644), [`4579364`](https://github.com/venn-lang/venn/commit/45793647baae3cbb64596cc502d3f312e3cd4f2d), [`1ac5629`](https://github.com/venn-lang/venn/commit/1ac56293b18b67f607949a0784e02b7fe28c8b8f), [`bd1dca2`](https://github.com/venn-lang/venn/commit/bd1dca2971a53642eb6d74a17334d0f8cef7f275), [`eba6e01`](https://github.com/venn-lang/venn/commit/eba6e011d3f311e23e5958fc264b99c6b4acf28e), [`39e3fa0`](https://github.com/venn-lang/venn/commit/39e3fa08896dafd53389cadd18cecab392168063), [`54243fe`](https://github.com/venn-lang/venn/commit/54243fed3a18c91ad57e6b9aa878d66510c6be6a), [`40ea17f`](https://github.com/venn-lang/venn/commit/40ea17f032320da70849e048f4a3381df858ffac), [`87905fa`](https://github.com/venn-lang/venn/commit/87905fa985f8fa79d4c9ec595d1e23f10202c7be), [`18ced18`](https://github.com/venn-lang/venn/commit/18ced18e272d5e15e8972751a87c6c88598ed951), [`34d1b24`](https://github.com/venn-lang/venn/commit/34d1b2410346f8cd211bc83a2bc42cede15c5c96), [`897350a`](https://github.com/venn-lang/venn/commit/897350ac4ca0334854c6338fd3449a515a15a805)]:
  - @venn-lang/core@0.7.0
  - @venn-lang/runtime@0.7.0
  - @venn-lang/lsp@0.7.0
  - @venn-lang/contracts@0.7.0
  - @venn-lang/sdk@0.7.0
  - @venn-lang/stdlib@0.7.0
  - @venn-lang/project@0.7.0
  - @venn-lang/http@0.7.0
  - @venn-lang/dts@0.7.0
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

### Patch Changes

- Updated dependencies [[`2667eb6`](https://github.com/venn-lang/venn/commit/2667eb68a1440a604f36898e777569a6f769680a), [`3534c4c`](https://github.com/venn-lang/venn/commit/3534c4c3fbc4c9cafe69798290add826098e0ba6), [`b126f71`](https://github.com/venn-lang/venn/commit/b126f712fcf7fb2229bd1af2888d440a7793c189), [`9193aeb`](https://github.com/venn-lang/venn/commit/9193aebcb85e1cac72fef13fa005fdb5d82c47a3), [`2f6fc07`](https://github.com/venn-lang/venn/commit/2f6fc07efdb01a3407a926a0e8222f81a13b5e58), [`5fe5dcd`](https://github.com/venn-lang/venn/commit/5fe5dcd265374e8bf5ff7fbfebfd26b4c2930ffe), [`70ae154`](https://github.com/venn-lang/venn/commit/70ae1549871c8a007eab67d8173d66906eb51688)]:
  - @venn-lang/stdlib@0.6.0
  - @venn-lang/core@0.6.0
  - @venn-lang/lsp@0.6.0
  - @venn-lang/runtime@0.6.0
  - @venn-lang/contracts@0.6.0
  - @venn-lang/io@0.6.0
  - @venn-lang/sdk@0.6.0
  - @venn-lang/project@0.6.0
  - @venn-lang/http@0.6.0
  - @venn-lang/assert@0.6.0
  - @venn-lang/dts@0.6.0
  - @venn-lang/types@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [[`4d59574`](https://github.com/venn-lang/venn/commit/4d59574ab379a127b81119a8d2b0b032605ab249), [`6ad7352`](https://github.com/venn-lang/venn/commit/6ad7352424bb745e0bde9a2ec8e7af2e34320c63), [`da8f14f`](https://github.com/venn-lang/venn/commit/da8f14f3c98cdb4560dbf34522108f5eb7bef1ba), [`80fe6bd`](https://github.com/venn-lang/venn/commit/80fe6bd5099d04a2a57779583ec6c7070b2fec46), [`9e97e7c`](https://github.com/venn-lang/venn/commit/9e97e7c4f68f53e9dfcd32aa2175e9f89942b952), [`2246faa`](https://github.com/venn-lang/venn/commit/2246faa06276fafbcb4e67b2a7acefe2cbe39eb5), [`fee4e1a`](https://github.com/venn-lang/venn/commit/fee4e1a0a0a2f6b74205b9e617db472fd1e23a28)]:
  - @venn-lang/core@0.5.0
  - @venn-lang/lsp@0.5.0
  - @venn-lang/runtime@0.5.0
  - @venn-lang/stdlib@0.5.0
  - @venn-lang/contracts@0.5.0
  - @venn-lang/dts@0.5.0
  - @venn-lang/project@0.5.0
  - @venn-lang/sdk@0.5.0
  - @venn-lang/assert@0.5.0
  - @venn-lang/http@0.5.0
  - @venn-lang/io@0.5.0
  - @venn-lang/types@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [[`5fc1774`](https://github.com/venn-lang/venn/commit/5fc17743005962cbc420580fd292a0ee31e5b291), [`e12a24d`](https://github.com/venn-lang/venn/commit/e12a24d8f81d38568f4d66a7a2b16d4aa9b5ca10), [`17b6fdb`](https://github.com/venn-lang/venn/commit/17b6fdbecbe4f567b750f58eb3f3ffef5448f1df), [`7a21703`](https://github.com/venn-lang/venn/commit/7a21703916428e1d32a1ad2757820d493fbc03c4), [`d05eb04`](https://github.com/venn-lang/venn/commit/d05eb04c415f3dd090e883a1909618ea00e782a6)]:
  - @venn-lang/core@0.4.0
  - @venn-lang/runtime@0.4.0
  - @venn-lang/types@0.4.0
  - @venn-lang/lsp@0.4.0
  - @venn-lang/stdlib@0.4.0
  - @venn-lang/dts@0.4.0
  - @venn-lang/sdk@0.4.0
  - @venn-lang/assert@0.4.0
  - @venn-lang/http@0.4.0
  - @venn-lang/io@0.4.0
  - @venn-lang/contracts@0.4.0
  - @venn-lang/project@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies [[`a8ad8b2`](https://github.com/venn-lang/venn/commit/a8ad8b205b257e9c57022b52ae3d20780b5a452a), [`03f7331`](https://github.com/venn-lang/venn/commit/03f73316ef5e2517dc0ca0085340bf684c4f0aa0), [`5fd9dc5`](https://github.com/venn-lang/venn/commit/5fd9dc5712065d8046de2c5621f4a7aa263536ac), [`badce1b`](https://github.com/venn-lang/venn/commit/badce1b8073274554ecc6d7b3033eb6daad2665b), [`f6016f3`](https://github.com/venn-lang/venn/commit/f6016f39dea8fb4d1b64bbb5163e6aedd7bac1ab), [`873c398`](https://github.com/venn-lang/venn/commit/873c39842b9d3b6095286d8dc08cb7862d19f2d5), [`adb36ab`](https://github.com/venn-lang/venn/commit/adb36abf8cc2026eac6fd4cf56b079c660a2a6ec), [`0735ab6`](https://github.com/venn-lang/venn/commit/0735ab6d7856672c3b300ec825de404ec20c4945)]:
  - @venn-lang/core@0.3.0
  - @venn-lang/lsp@0.3.0
  - @venn-lang/runtime@0.3.0
  - @venn-lang/stdlib@0.3.0
  - @venn-lang/contracts@0.3.0
  - @venn-lang/dts@0.3.0
  - @venn-lang/project@0.3.0
  - @venn-lang/sdk@0.3.0
  - @venn-lang/assert@0.3.0
  - @venn-lang/http@0.3.0
  - @venn-lang/io@0.3.0
  - @venn-lang/types@0.3.0

## 0.2.0

### Minor Changes

- [#102](https://github.com/venn-lang/venn/pull/102) [`025b5a0`](https://github.com/venn-lang/venn/commit/025b5a00582bdd6a9ff2ace91b23b7e7d7d337c5) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - This package is now a version of the language rather than the command you install. It provides `venn-run` and `venn-lsp`, which the `venn` orchestrator runs. Install `@venn-lang/venn` to get the `venn` command.

- [#108](https://github.com/venn-lang/venn/pull/108) [`f99e1b3`](https://github.com/venn-lang/venn/commit/f99e1b31b2d8f0242d0329e1693dbe187f37a5b9) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - The `venn` command moved to its own package. If you installed `@venn-lang/cli` from 0.1.x, move across in this order:

  ```bash
  npm rm -g @venn-lang/cli
  npm i -g @venn-lang/venn
  ```

  Both packages want the name `venn`, and npm refuses to take a name another package holds, so installing before removing fails with `EEXIST`. Running the old `venn` after upgrading `@venn-lang/cli` prints these two lines rather than leaving you with a command that is gone.

  Nothing you have written changes. `venn test`, `venn run` and the rest work as they did, on the version each project asks for.

### Patch Changes

- [#107](https://github.com/venn-lang/venn/pull/107) [`3053fe7`](https://github.com/venn-lang/venn/commit/3053fe7c091c0dba3b162cd4f55c34454461f148) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Upgrade the language, not the package it came in.

- Updated dependencies []:
  - @venn-lang/contracts@0.2.0
  - @venn-lang/core@0.2.0
  - @venn-lang/dts@0.2.0
  - @venn-lang/lsp@0.2.0
  - @venn-lang/project@0.2.0
  - @venn-lang/runtime@0.2.0
  - @venn-lang/sdk@0.2.0
  - @venn-lang/assert@0.2.0
  - @venn-lang/http@0.2.0
  - @venn-lang/io@0.2.0
  - @venn-lang/stdlib@0.2.0
  - @venn-lang/types@0.2.0

## 0.1.3

### Patch Changes

- [#76](https://github.com/venn-lang/venn/pull/76) [`3e93ea7`](https://github.com/venn-lang/venn/commit/3e93ea70f219eae1d856ed876cd9d0178636ebc1) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Ask node where it is, instead of naming directories.

- Updated dependencies [[`cd42016`](https://github.com/venn-lang/venn/commit/cd420167006ad0ac34dc57dd7a6676516e1ca97d)]:
  - @venn-lang/contracts@0.1.3
  - @venn-lang/core@0.1.3
  - @venn-lang/project@0.1.3
  - @venn-lang/runtime@0.1.3
  - @venn-lang/sdk@0.1.3
  - @venn-lang/http@0.1.3
  - @venn-lang/io@0.1.3
  - @venn-lang/stdlib@0.1.3
  - @venn-lang/assert@0.1.3
  - @venn-lang/dts@0.1.3
  - @venn-lang/types@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [[`906eb82`](https://github.com/venn-lang/venn/commit/906eb826eb0130f198d52ffa03903be54eacfd89)]:
  - @venn-lang/contracts@0.1.2
  - @venn-lang/core@0.1.2
  - @venn-lang/project@0.1.2
  - @venn-lang/runtime@0.1.2
  - @venn-lang/sdk@0.1.2
  - @venn-lang/http@0.1.2
  - @venn-lang/io@0.1.2
  - @venn-lang/stdlib@0.1.2
  - @venn-lang/assert@0.1.2
  - @venn-lang/dts@0.1.2
  - @venn-lang/types@0.1.2

## 0.1.1

### Patch Changes

- [#59](https://github.com/venn-lang/venn/pull/59) [`acb103f`](https://github.com/venn-lang/venn/commit/acb103f51f5ac3530fb71850374714c97fa90cd7) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Report the version the release actually is.

- Updated dependencies []:
  - @venn-lang/contracts@0.1.1
  - @venn-lang/core@0.1.1
  - @venn-lang/dts@0.1.1
  - @venn-lang/project@0.1.1
  - @venn-lang/runtime@0.1.1
  - @venn-lang/sdk@0.1.1
  - @venn-lang/assert@0.1.1
  - @venn-lang/http@0.1.1
  - @venn-lang/io@0.1.1
  - @venn-lang/stdlib@0.1.1
  - @venn-lang/types@0.1.1

## 0.1.0

### Minor Changes

- [#27](https://github.com/venn-lang/venn/pull/27) [`a81b246`](https://github.com/venn-lang/venn/commit/a81b2460324c7a4179b96ff9167cc30b7f55e780) Thanks [@viniciusborgeis](https://github.com/viniciusborgeis)! - Add `venn upgrade`, which moves a global install to the latest published version.

  It finds which of npm, pnpm, yarn or bun installed the running copy by reading the path it lives in,
  then runs that manager's own global install. A copy the project owns is left alone, since its version
  is pinned in the manifest, and a path matching no manager is refused rather than guessed at. Use
  `--dry-run` to see the command without running it, or `--yes` to skip the confirmation in a script.

### Patch Changes

- Updated dependencies []:
  - @venn-lang/contracts@0.1.0
  - @venn-lang/core@0.1.0
  - @venn-lang/dts@0.1.0
  - @venn-lang/project@0.1.0
  - @venn-lang/runtime@0.1.0
  - @venn-lang/sdk@0.1.0
  - @venn-lang/assert@0.1.0
  - @venn-lang/http@0.1.0
  - @venn-lang/io@0.1.0
  - @venn-lang/stdlib@0.1.0
  - @venn-lang/types@0.1.0
