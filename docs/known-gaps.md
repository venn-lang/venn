# Known gaps

Places where the language, the specification and the implementation disagree.
Each is found by writing real code against Venn, not by reading it, and each is
kept here with the snippet that reproduces it.

Nothing here is ever a crash. They are things a user will reasonably try, and be
surprised by.

Every snippet below was run on the built CLI, `venn run` unless the output names
`venn check`, and the output is verbatim.

---

## 1. The reference manual is not in the reader's language

**Severity: high, and it is the amplifier under most of the rest.**

`docs/venn-language.md` is the reference, and it is in Portuguese: `## 00 ·
Quatro camadas, uma regra`, `### O corpo de uma função`. `docs/type-system.md`
opens `# Tipos da Venn`.

The measurement, not the worry. Someone spent an hour writing three ordinary
programs against this language and opened the reference as prose **zero** times,
reading package sources five times instead, because the sources are in English.
In that hour they hand-rolled five counting loops without ever finding `forEach`,
which line 204 of the reference has held the whole time:

```
| Controle | if else forEach in repeat loop parallel race try catch finally break continue return run | Composição de execução |
```

and destructuring, which is at line 291.

That is the whole cost of the gap: for a reader who cannot read the reference,
**the diagnostics are the documentation.** It is why a message that does not name
what is missing costs an hour instead of a minute, and it is worth knowing when
weighing any of the entries below.

Not fixed here on purpose. Translating it is mechanical, large, and would bury a
diff that is otherwise about behaviour, and it is the owner's document in the
owner's language, so the decision is his. An English cheatsheet beside it is
explicitly not the answer: a second document is how a specification acquires two
owners and then two truths.

## 2. The top level and a block follow different separator rules

**Severity: medium.** The same two lines are legal at the top of a file and
refused one brace deeper.

```ruby
const a = 1 const b = 2
```
```
✓ no problems found
```

```ruby
flow "F" { step "s" { let a = 1 let b = 2 } }
```
```
VN1002 · Expected a closing brace here, found `let`.
  at    …\g2b.vn:1:33
```

`entry Document` and `NamespaceDecl` trail each item with an optional `NL*`,
while `Block` and `FnBlock` put a required `NL+` between them. The consequence is
not the error, which is explained now; it is that `examples/basics/` is all
top-level script, so the rule a reader learns first is not the rule that holds
the moment they write their first `flow`.

It was closed during this work and then put back, and both costs are now measured
rather than guessed. Giving `Document` the block shape works, and the reason it
went back is that it costs a diagnostic: `print match x { … }` and `print run
f()` stop parsing, so `VN5007`, which says a value became a statement of its own,
never fires. The other cost was the one predicted in advance: the loop over the
imports has to look past a newline repetition to see whether the next word is
`import`, which is the lookahead class Chevrotain reports as ambiguous. So the
choice is a grammar irregularity against a lost lint, and it is
[on the roadmap](../ROADMAP.md) as a question rather than settled here.

## 3. Dead newline alternatives in a list pattern

**Severity: low.** The grammar offers a separator the lexer makes unreachable, so
the two destructuring forms disagree with each other.

```ruby
const [a; b] = [1, 2]
```
```
VN1001 · A `;` is a statement separator, and inside `( )` and `[ ]` there are no statements, so write a comma.
  at    …\lp.vn:1:9
VN1002 · Items inside `( )` and `[ ]` are separated by a comma, and a newline there is not one.
```

The first sentence is right and the second is the cascade behind it: the parser
was offered a newline separator the grammar promises and the lexer had already
removed.

The multi-line spelling, `const [` then `a` then `b` then `] = xs`, fails the
same way at 3:3. The map form does not: `const { a; b } = m` and its multi-line
spelling are both clean, because a `{` gives the newline back and a `[` does not.

`ListPattern` in the grammar writes `((',' | NL)+ items+=Pattern)`, and every one
of those `NL`s is inside a `[`, so they are alternatives nothing can reach.
Deleting them is the fix, it is pure removal, and it wants a test asserting the
multi-line list pattern so the deletion is not quietly put back.

## 4. A `;` glued to a line break inside brackets is still dropped in silence

**Severity: low.** Written alone it is now refused by name. Written against a real
newline it is not.

```ruby
const xs = [1;
2]
```
```
VN1002 · Items inside `( )` and `[ ]` are separated by a comma, and a newline there is not one.
  at    …\semi.vn:2:1
VN1002 · Expected the end of the file here, found a closing square bracket.
```

Nothing mentions the `;`. The lexer's `NL` terminal is one token per *run* of
newlines and semicolons, so `;` followed by a newline is a single image. The
suppression inside `( )` and `[ ]` now tests that image for a line break, which
is what lets a lone `;` survive and earn the sentence in entry 3, and the `;`
inside a mixed image cannot be refused without splitting the terminal.

## 5. Strings have no `concat` and no `join`, and lists have both

**Severity: low.**

```ruby
print "a".concat("b")
```
```
VN3010 · Type string has no member "concat".
  at    …\cc.vn:1:7
  help  `concat` is a member of a list, not of a string.
```

The message names the fix, which is the whole of what changed here. What is left
over is the asymmetry underneath it: a list publishes both `concat` and `join`
and a string publishes neither, so the two things a reader is most often holding
do not answer to the same members. That `+` does not join strings is decided and
is not a gap: interpolation is how this language joins strings, `"${a}${b}"`, and
the reference says so now.

## 6. `try` and `catch` cannot produce a value together

**Severity: medium.** You can have the value or the message, never both.

```ruby
import { json } from "venn/json"

const porta = try json.parse("nao json").porta else 8080
print porta
```
```
8080
```

That works, and discards the error. `json.tryParse` returns `null` with no
message and `json.isValid` returns a verdict with no message, so the three ways
of surviving bad input all throw away the one thing a program wants to print.
The statement form is the other half: it keeps the error and cannot hand a value
out of the block. A program that wants both parses the document twice.

## 7. `filter` does not narrow what it filtered

**Severity: medium.** The list a `filter` hands back has the element type it
started with, so a value the filter has just removed is still in the type of
every lambda below it.

```ruby
fn markOf(n) {
  if n < 0 { return null }
  return n
}
const marks = [1, 0 - 2, 3].map(n => markOf(n))
const good = marks.filter(m => m != null)
const total = good.map(m => m + 1).sum

print total
```
```
VN3010 · Type mismatch: expected number, found null | number.
  at    …\nf.vn:7:29
  help  It may be nothing. Give it a stand-in with `?? …`, or ask `if x != null` first.
```

The nullable has to reach an operator for this to show: `good.map(m => m).sum`
says nothing, because `sum` is declared to answer a number and never looks at an
element. Column 29 is the `m + 1`.

The checker is not wrong, it is under-informed, and TypeScript reports the same
shape without a type predicate. `narrowed()` already narrows on an `if`
condition; nothing carries a predicate lambda's narrowing back out to the list it
filtered, so the way through is the stand-in the help line names. It became
visible when lambda bodies started being checked at all, rather than being caused
by that: before, every member read on a lambda parameter answered a type the
checker declined to name. It stays open because narrowing out of a lambda is real
type-system work rather than a diagnostic.

## 8. The shipped binary holds two copies of the error class, and no test can see it

**Severity: medium, and it is the only entry here that the test suite is
structurally unable to catch.**

`packages/contracts` is built in two passes, a neutral one and a node one, so
`dist/node.mjs` inlines its own copy of `venn-error.js`. The bundled CLI
therefore contains the class twice, and an `instanceof VennError` answers `true`
for a failure raised through one copy and `false` for the same failure raised
through the other. A file-system verb raises through the node copy, and reading a
file that is not there printed this:

```
File not found: "nowhere.json".
```

No code, no place, no `docs` line, while `json.parse` on the same binary in the
same second printed a full `VN7003` with all three.

What closed the symptom is that the reporter no longer depends on the class
*alone*: it now also recognises a failure carrying a code the language
catalogues, decided by `docsFor`, which is already the single owner of "a code of
ours". The `instanceof` gate stays, because a `VennError` carrying a code that is
not ours and no problem still needs it. Deliberately not "carries any string
code": a Node `ENOENT` carries one, and widening that far would turn every stray
from below the language into a `VN7000`.

What remains is not a symptom, it is a rule nobody can enforce. Under vitest the
`development` condition resolves both entries to `src/`, so both reach the same
module and there is exactly one class; the defect exists only in the bundle.
`scripts/the-tarball-is-whole.test.mjs` is the one guard in this repository that
reads the shipped bundle rather than `src`, and its own docblock describes this
class from the last time it bit. This is the second instance, and the assertion
that would have caught it is one line: `dist/cli.mjs` holds two copies of the
class today and a test can pin that at one.

Whoever writes that line: **pin it at one, expect red, and treat the red as the
tracking issue.** The tempting repair is to pin two so the suite goes green, and
that makes the defect the specification: the next person to fix the build split
reads their own fix as a regression. It is the same trap as re-recording an
example, except there is no earlier value in the diff to notice. Leaving the
assertion unwritten until the split is fixed is also fine. Pinning two is the one
outcome that costs.

Merging the two build passes is not the answer: it would put `node:*` behind the
neutral entry and lose the boundary that configuration exists to draw. That
boundary is held by `scripts/neutral-means-no-node.test.mjs` rather than by the
build, which warns and exits 0 on a `node:*` import in a neutral pass whatever
four configuration files say about it.

## 9. Reading a directory answers in the operating system's words

**Severity: low, and it is the one place a reader meets a sentence the language
did not write.**

```ruby
import { fs } from "venn/fs"
print fs.read("examples")
```
```
VN8019 · EISDIR: illegal operation on a directory, read
  at    …\fd.vn:2:7
  docs  https://venn.dev/e/VN8019
```

`fs.read("")` says the same thing, because an argument that is nothing becomes
the empty path, which resolves to the root the host was given, which is a
directory. Neither is refused at the argument.

The code, the place and the docs link are all right; the sentence is Node's. It
comes from the file-system port's mapping rather than from the `fs` verbs, so
fixing it means deciding what the language says about a path that is the wrong
kind of thing, and that is a sentence somebody has to own. Everything else in
that namespace answers instead of raising: `fs.exists` says `false`, `fs.list`
says nothing, and `fs.write` makes what it needs.

## 10. Two places where a merged line is still not named

**Severity: low.** A call with bare arguments reads whatever follows it as another
argument, so a missing separator can produce one statement rather than a syntax
error. That is named now, at the swallowed word:

```ruby
print 1 print 2
```
```
VN2027 · `print` is an action, not a value, so this line is read as one statement.
  at    …\m1.vn:1:9
  help  Put a `;` or a newline before `print` to start the next statement.
```

Two shapes are left. Inside a `deco` body the separator is never mentioned:

```ruby
deco d(target: Fn) { print 1 print 2 }
```
```
VN2016 · A decorator runs before the program exists, so it cannot call `print`.
  at    …\m2.vn:1:22
VN2023 · `print` is out of reach here: a decorator runs before the program exists.
  at    …\m2.vn:1:30
```

Both sentences are true and neither says two statements ran together, and the
second one lands on the swallowed word. The check that intercepts everything
inside a `deco` answers nothing for a node that is not a call, which switches off
every ordinary check in there. Turning one back on would put a third error on a
line already refused twice.

And a namespace the file declares itself merges in silence:

```ruby
namespace tools { pub fn a() => 1 }
print 1 tools 2
```
```
✓ no problems found
```

A name the file declares counts as a binding and a binding has to win, which is
what keeps `const path = req.url.before("?")` working while `venn/path` exists.
Telling a declared namespace from a declared value needs the checker to record
which kind of declaration a name came from, and it deliberately does not.

Not a gap and never will be: `const one = 1` then `print 1 one 2` is silent, and
has to be. It is character for character the shape of `http.on api route`, which
seven committed examples use.

## 11. A recorded output is load-bearing on how fast the machine is

**Severity: medium, because it makes a green suite go red for a reason that has
nothing to do with the change in front of you.**

`examples/programs/watchtower/main.vn` prints a table whose rows carry a real HTTP
round trip, `"${one.ms}ms"`. `widthOf` in the table renderer sizes each column
from the longest cell it was given, and the normalizer substitutes `<ms>` for the
duration only afterwards, so the digit count of a real measurement has already
decided the column. A two-digit response gives a four-wide column and a
three-digit one gives five, and the header moves with the rule line under it:

```
took  │        instead of        took │
```

`node scripts/examples-run.mjs --check` then reports it as a changed expectation,
which is what it looks like and is not what it is. Never re-record it: pinning a
loaded machine's timing makes the correct output on a quiet one read as a
regression, and there is no diff to catch that.

Closing it means keeping a digit count out of an aligned column, either by not
printing a raw duration into a table or by normalising before the padding rather
than after. It is the one recorded expectation in the corpus that depends on wall
clock speed, and it is worth knowing that it exists before spending an afternoon
bisecting for it.

## 12. `?.` asks about a member and there is no `?.()` for a call

**Severity: low, and it costs three lines every time it is met.**

Reading past the end of a list answers nothing, so a positional read is a value
that may be missing. When that value is a function, calling it needs a guard, and
the spelling every reader arrives with is refused:

```ruby
const made = [fn () => 2]
let a = made[0]?.()
```
```
VN1002 · Expected the end of the file here, found an optional dot.
  at    …\oc.vn:2:16
```

The way through is a named binding and an `if`, which works and says the same
thing in three lines instead of one:

```ruby
const made = [fn () => 2]
const f = made[0]
if f != null { print f() }
```
```
2
```

`?.` covers a member read and stops there. Every language with optional chaining
has the call form too, so this is a spelling a reader will try before they try
the guard. It is left because new syntax at the end of a change that already
moves what the checker believes about absence, unknown names, indexing, lambda
bodies, arithmetic and purity is a follow-up rather than a finishing touch.

## 13. Three places a message stops one sentence short

**Severity: low each, and they are together because they are one habit.** In all
three the diagnostic is correct and declines to say the thing the reader needs
next.

A callback's accumulator is not checked, while its item is:

```ruby
const xs = [1, 2, 3]
print xs.reduce((t, x) => t.nope, 0)
```
```
✓ no problems found
```

`xs.reduce((t, x) => t + x.nope, 0)` reports correctly, so it is the accumulator
alone. `reduce` is typed with the accumulator as a fresh variable and a call's
arguments are walked left to right, so the callback is read before the seed `0`
has taught it anything, and an unknown parameter is deliberately left unchecked
rather than checked against a guess. Closing it means ordering a call's arguments
by which of them constrain the others.

A transposed pair gets no suggestion, while a dropped letter does:

```ruby
const p = { name: "a", age: 1 }
print p.naem
```
```
VN3010 · Type { name: string, age: number } has no field "naem".
  at    …\t1.vn:2:7
```

`p.nam` does get `Did you mean `name`?`. A swap counts as two edits and the
shared nearest-name refuses two on a four-letter word, which is right in general.
The fix is Damerau distance inside that one function, which moves six callers at
once and so wants a single owner.

And a conversion is a member, which the message never says:

```ruby
const s = "42"
print number(s)
```
```
VN2018 · Nothing is named "number" here.
  at    …\t2.vn:2:7
  help  Bind it with `const` or `let`, or bring it in with `import`.
```

The answer is `s.toNumber`, and neither the title nor the help mentions that
conversions live on the value. The same holds for `int`, `str` and `bool`.

A note that belongs with all three, because it is the limit of the habit that kept
this change honest. Every help line here was run before it was shipped, which is
why none teaches a spelling the language does not have. That is not the whole
check. `forEach r in rows { print r }` runs perfectly, and it was still the wrong
advice for `let z = rows.forEach(r => print r)`, because following it deletes the
`let z =` the reader wrote. Running the fix proves the spelling exists; it does not
prove the fix fits the program that earned it. The second question is whether
anything the reader wrote disappears when the rewrite is applied to their actual
line.

There is a cheap test for which advice needs that second question: **only
identifiers is safe; punctuation or a construct boundary is not.** Swapping a name
for a name cannot fail. Anything else has to be applied to a real earning line and
read back, including a rewrite that stays inside one construct, because a delimiter
that gets escaped becomes content.

The ways it went wrong in one afternoon, each found by the author of the message:
a rewrite that deletes what the reader wrote; one that produces a worse diagnostic
than the message it replaced; one that produces a correct program meaning something
else; one that compiles and then always fails at run time; one that describes a
program the reader had already written; one whose guard moves the name out of the
scope that reads it, so the advice for a silent wrong answer produces a silent
wrong answer; and one that narrows a name where the reader is holding an index
read, so following it earns the same error again.

Two things generalise. **A help line is a claim, bound by the same rule against
over-claiming as a type, and the way to test it is to assert that the repaired
program reports nothing**, not that it parses, because one of the seven above
produced a program that compiled and reported the same error again. Written as an
empty problem list beside the diagnostic it costs nothing and fails the day
somebody changes the advice, where a habit of running it before shipping dies with
whoever had the habit. And advice that leaves a real error behind is correct, while
advice that leaves an error it created is not.

## 14. Three docblocks teach a command that destroys other people's work

**Severity: medium, and it is the one entry here about the repository rather than
the language.**

`scripts/charter.test.mjs:17`, `scripts/charter.mjs:15` and `scripts/charter.mjs:82`
all tell a reader to run `node scripts/charter.mjs --write` when a counted number
goes down, so the improvement lands as a smaller number in a reviewed diff. That
advice is right for one person owning the whole tree and destructive for any
number greater than one, and none of the three says so.

The write is a whole-file regeneration rather than a merge, so it drops every
hand-added line for a file that was absent from disk or measured clean at that
instant. Six lines across three separate pieces of work went that way in one
afternoon, and the person who ran it saw nothing wrong, because their own tree
looked right. The failure then surfaces under the name of somebody who has
already finished.

Three ways out and no view on which: the docblocks say the qualification, or
`--write` merges instead of replacing, or it refuses when the working tree carries
changes it did not make. Until then the safe procedure under more than one writer
is to edit the single number by hand. It is the same class as
`packages/cli/src/same-everywhere/same-everywhere.test.ts:97`, which names the
wrong package to filter on, and as entry 11: a documented instruction that is
wrong in exactly the situation a reader is most likely to be in when they read it.

`node scripts/examples-run.mjs --write` has the identical shape and the same
hazard: it drives all 84 examples and rewrites the whole file, with no
per-example path, so a write meant to bank one legitimate change pins every other
open failure as the specification at the same time. Those stop appearing in the
check and read as fixed, with no diff anyone would question. Hand-edit the single
entry.

A green build log is not evidence the binary runs, and that is measured rather
than feared: of eight `pnpm venn:build` runs in one afternoon, five produced a
binary that died on `print "hello"`, and every one of the five exited 0 with no
error line. The bundler emitted an undefined identifier and returned success
twice. So the list of gates that answer a different question than the one being
asked is longer than it looks: `pnpm test` never links the bundle, `npx tsdown`
from inside a package skips runtime, stdlib and every std package, `venn check`
never executes the program, `tsc` did not name a live two-argument call at a
one-parameter function, and `venn:build` exiting 0 says nothing about whether the
bundle executes. The only thing that answers it is running a program, which is why
the smoke check is eight lines rather than one, and every line of it was added
because something passed the shorter version and was still broken.

The corollary says who is exposed: a slice that prints a fix gets a smoke test for
free, and a slice that only makes the checker refuse things can pass `venn check`
on a binary that cannot execute one statement. Most work on a language is on the
second side.

The same hazard reaches the instruments used to measure any of this. A count of
untracked files taken with `git status --porcelain | grep "^??"` reported 235 where
the answer was 98, because `?` is a quantifier, so `^??` reads as an optional
anchor and admits every modified file. **A number is only as good as the filter
that produced it, and a breakdown that cannot be true is how you find out**: the
per-directory rows contained modified paths, which cannot appear in untracked
output. A `grep -c` on a pattern nobody read is the same defect as a help line
nobody ran, except that nothing contradicts it.

And the counted rules have a hole of their own. `charter.test.mjs` asserts that
all five rules are written down and that no number climbs; nothing asserts that a
baseline entry names a file that exists. Two of them named a deleted file on this
branch, under two different rules, and both passed, because a number is always
allowed to shrink. An entry naming nothing is a rule that has quietly stopped
being enforced, and a fourth assertion closes it.

One more thing worth recording beside all of this, because it is the strongest
argument in the batch for the discarded-result warning and it is not a
hypothetical. Restructuring `examples/basics/11-math.vn` under time pressure, an
expert needed to accumulate into a list and wrote `rolls = rolls.push(...)`. The
bare `rolls.push(...)` is the reflex from the language most readers arrive from;
it would have compiled, run, printed `five rolls: []`, and been pinned as correct
by a re-record nobody would have questioned. The warning catches that at check
time. The defect it prevents was reproduced by somebody who knew the rule, in the
change that introduced the rule, within an hour of writing it down.

## 15. Three type annotations that still mean nothing

**Severity: low each.** A type annotation that names nothing is refused now, in
eighteen positions. Three positions are left where it is not, and each has a
different reason.

A plugin-qualified name is not checked:

```ruby
import { http } from "venn/http"
let q: http.Banana = 1
```
```
✓ no problems found
```

Deliberate, and the right call: the type catalogue can be asked what a name means
and cannot be asked whether a name is a namespace, so the checker cannot tell "the
plugin does not publish that" from "no catalogue was supplied". Refusing what it
cannot know refuses correct programs, which is the mistake this whole change was
trying to stop. Closing it is one method on the catalogue.

A `type` declared inside a `namespace` is invisible to the file's type table:

```ruby
namespace n { pub type T { a: number } }
let q: n.T = { a: 1 }
```
```
✓ no problems found
```

`n.T` resolves to a type the checker declines to name, so nothing is checked
against it and nothing is said. The bare spelling `let q: T` is correctly refused.
The collector that builds the table walks a document's declarations only, and the
one that walks inside a `namespace` gathers a `fn`, a binding and a nested
namespace, never a `type`. It predates this work.

And a `fragment`'s return type is read for the names in it and checked against
nothing:

```ruby
fragment g() -> banana {
  print 1
}
```
```
VN2018 · Nothing is named "banana" here.
  at    …\c.vn:1:17
```

That is the position nothing read at all until now, so the name in it is verified
and the body still is not. It is the last annotation in the language that a
program can get wrong without being told, and closing it means a return sink for a
`fragment` the way a `fn` already has one.

## 16. `zip` drops what does not pair, and says nothing

**Severity: medium, because it produces a shorter right answer rather than a wrong
one, which is harder to notice.**

```ruby
print [1, 2, 3].zip(["a"])
```
```
[[1, "a"]]
```

Two elements are gone and nothing is said. A program that zips two lists it
believes are the same length and then reads the pairs gets a clean answer computed
over a third of its data.

It is left rather than fixed because the surprise is born here and not downstream.
A pattern that reads a pair is refused when the pair is short, which `zip` never
produces, so making the pattern stricter cannot catch this, and making `zip` refuse
a length mismatch changes a member's contract. Fixing the two in opposite
directions would be worse than fixing neither. What is not in question is that the
silence is the defect: truncating is a defensible answer, truncating without a word
is not.

## 17. `mock` is callable from a pure `fn` and keeps state between calls

**Severity: medium.** Purity is decided from what a verb reaches, and this is the
one namespace where that question has no answer to read.

```ruby
import { mock } from "venn/mock"

fn allowed() => mock.flag("beta")
```
```
✓ no problems found
```

`mock`'s eight verbs reach no port, so no capability can be derived and none is
declared, and a verb that declares nothing is callable inside a `fn`. But they
mutate a store held at module level: `mock.flag("beta")` answers differently
depending on what ran before it, and `mock.clock.freeze` is the clock. So a `fn`
calling one is not pure in the sense the rule exists to protect, and no guard
built on ports can see it, because there is no port to observe.

What the language lacks here is a way to declare state rather than reach.
`atFlowStart` is the field that could carry it and no plugin declares one. Until
something can express "this verb remembers", the rule is right about every
namespace but this one.

Two neighbours are refused deliberately and are not gaps. `crypto.hash` and
`crypto.hmac` are deterministic and stay out, because they answer through a port
and a verb whose answer comes from a port cannot promise it touches nothing,
whatever that port computes; the fix is to split the port, not to weaken the
guard. And `date.parse` is left unannotated because parsing a date and time with
no offset reads the host's own timezone, so the same text is a different moment on
a different machine, which is the same class as the path separator and has not
been ruled on.

---

Nothing here is a promise that the list is complete, and an empty list would not
be a promise either. This file is where the next one goes: a gap belongs here the
day it is found, with the program that shows it, before anybody argues about
whose fault it is.

## What used to be here

Every entry this file held before is closed. What they were, and where the
answer now lives:

| Was | Closed by |
| --- | --- |
| Nothing could carry state through a loop | `loop`, which binds state and carries it through `continue` (§06) |
| The specification promised syntax the grammar did not have | The raw string and the block string are in it, and a pattern is a `regex` value rather than a literal (§03) |
| Optional chaining failed the checker on a known shape | `?.` asks whether something is there, so "no" is an answer (§04) |
| `pub` covered only three declarations | It covers `fn`, `fragment`, `deco`, `type`, a binding and a `namespace` (§10) |
| A bare argument could not hold a binary operator | Kept, with `VN1002` saying which brackets to write (§04) |
| A `Type` decorator ran but could not type-check | Shape decorators run before anything is checked (§08) |
| Step titles did not interpolate | A title is filled against the scope it belongs to (§05) |
