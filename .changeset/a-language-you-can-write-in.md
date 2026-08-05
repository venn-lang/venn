---
"@venn-lang/contracts": minor
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/sdk": minor
"@venn-lang/stdlib": minor
"@venn-lang/project": minor
"@venn-lang/cli": minor
"@venn-lang/lsp": minor
"@venn-lang/prelude": minor
"@venn-lang/fs": minor
"@venn-lang/date": minor
"@venn-lang/math": minor
"@venn-lang/crypto": minor
"@venn-lang/mock": minor
"@venn-lang/db": minor
---

The language stops saying yes and meaning nothing.

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
`venn check`, and always fails at run time. ``write `print(…)` to call it`` was
considered and dropped because an ellipsis is not something a reader can type.
The better reason arrived later: `const a = print("x")` passes the checker and
dies with `VN3013`, for every prelude verb, on every input, because reading a
verb answers `null` and `null` is then called. That is closed here too.

Two more shapes turned up once the slices went looking. A help line whose
**factual claim about the reader's data** is unsupportable: a pair guidance that
said "a two-item list" on a `list<number>`, which carries no arity, is the same
over-claiming the checker was fixed for. And advice that is correct, compiles,
and costs a restructure the sentence gives no hint of: ``a verb belongs in a
`fragment`, or at the top level of a file`` is honest for a `fn` whose caller you
control and misleading for one woven into other `fn`s, where following it moves
five files.

The usable form of the rule is cheap. **A rewrite that touches only identifiers
is safe. A rewrite that touches punctuation must be applied to a real earning
line and read back for what it now says, not merely run**, because a delimiter
escaped is content, which is how a quote-swap changed a map key. Crossing a
construct boundary has to be diffed for what vanished. And advice that leaves a
real error behind is correct; advice that leaves an error it created is not.

All of which reduces to one sentence: **a help line is a claim, bound by the same
do-not-over-claim rule as a type.** The durable form of the check is a test that
asserts the repaired program reports **nothing**, rather than that it parses:
``ask `if x != null` first`` produced a program that compiled and reported the
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
`"unknown option: " + "x"` can only ever produce ``Write `"unknown option: x"` ``.
That is not virtue, it is a property of building the answer from the input, and
it is the cheapest defence against the whole class.
