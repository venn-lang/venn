# Programs

Six programs rather than six demonstrations. Each one does a job somebody
would otherwise do by hand, each lives in its own folder with its modules and
its tests beside it, and each was written by writing it: the language was found
wanting on the way, and every one of those is an issue linked below rather than
a paragraph explaining why the example is shaped oddly.

| program | what it does | run it |
| --- | --- | --- |
| [`pokedex/`](pokedex) | a command-line Pokedex: one at a time, or a team at once | `venn run examples/programs/pokedex/main.vn pikachu eevee` |
| [`watchtower/`](watchtower) | asks a list of services whether they are alive | `venn run examples/programs/watchtower/main.vn` |
| [`ledger/`](ledger) | an expense report: claims in, what the company pays out | `venn run examples/programs/ledger/main.vn` |
| [`gradebook/`](gradebook) | weighted marks, grades, and the rows it will not grade | `venn run examples/programs/gradebook/main.vn` |
| [`standup/`](standup) | a rota across three timezones | `venn run examples/programs/standup/main.vn` |
| [`pantry/`](pantry) | a week of meals against the cupboard, and what the supplier refuses | `venn run examples/programs/pantry/main.vn` |

Every folder has a `tests.vn`. Together they are 142 assertions written in Venn
against programs written in Venn:

```bash
venn test examples/programs/pokedex/tests.vn      # 22
venn test examples/programs/watchtower/tests.vn   # 30
venn test examples/programs/ledger/tests.vn       # 18
venn test examples/programs/gradebook/tests.vn    # 20
venn test examples/programs/standup/tests.vn      # 20
venn test examples/programs/pantry/tests.vn       # 32
```

## One folder each, and the same shape in all of them

```
program/
  main.vn        the program: arguments, the words a person reads
  <module>/      what it knows, split by what may reach the world
    mod.vn       the face of the folder
  tests.vn       flows against the module
  README.md
```

The split inside each one is not a convention somebody chose. A `fn` is pure and
cannot make a request; a `fragment` can. So the line between "what this knows"
and "how it finds out" is drawn by the language, and every program here falls
along it: `pokedex/dex/entry.vn` against `pokedex/dex/fetch.vn`,
`watchtower/watch/verdict.vn` against `watchtower/watch/probe.vn`,
`pantry/larder/plan.vn` against `pantry/larder/supplier.vn`.

It is also what makes the tests cheap. The pure half needs nothing stood up, and
the half that reaches the world takes its address as an argument, so a test hands
it a server it started itself rather than cutting a test-shaped hole in the
program.

## Which one to read

- **What a real program looks like end to end**: [`pokedex/`](pokedex). Command
  line and prompt, a public API, four requests in flight, and three decorators
  it wrote for itself.
- **Doing several things at once**: [`watchtower/`](watchtower). `parallel`,
  `race` and `forEach { concurrency }` in one program, and the reason they are
  three different words.
- **Modules and a folder that reads as one name**: [`ledger/`](ledger).
- **Refusing bad data properly**: [`gradebook/`](gradebook).
- **Units and time**: [`standup/`](standup).
- **Failing, and carrying on**: [`pantry/`](pantry). Two failure codes because
  the caller does two different things about them, and a `try` inside the loop
  so one refusal costs one item.

## Everything runs offline except one

[`pokedex/main.vn`](pokedex/main.vn) talks to the real
[PokeAPI](https://pokeapi.co), deliberately: an example of talking to somebody
else's service that talks to nobody is not an example of anything. Its tests do
not, and neither does anything else here. [`watchtower/`](watchtower) given no
arguments stands three services of its own up and watches those.

## What writing them found

Seventeen bugs, and they are the reason most of these programs exist. Thirteen
of them were found by writing the first five; four were found by the sweeps that
fixed those thirteen. [`pantry/`](pantry) came after all of them and found none,
which is the only reason it reads straight through.

All thirteen are fixed, and three of them changed how a program here is written:

- The pokedex keeps its display functions in
  [`dex/show.vn`](pokedex/dex/show.vn), beside the data they format, which is
  where they belong. Until [#227](https://github.com/venn-lang/venn/issues/227)
  a decorator written in an imported file was dropped in silence, so they had to
  sit in the entry file to take effect at all.
- The watchtower has a `took` column and a slowest line, which needed
  [#235](https://github.com/venn-lang/venn/issues/235) and
  [#237](https://github.com/venn-lang/venn/issues/237): a response's time was
  always zero and two moments could not be subtracted, so nothing in the
  language could answer how long anything took.
- `verdictOf` is a guard clause and one line behind it rather than two levels of
  nesting, which needed
  [#238](https://github.com/venn-lang/venn/issues/238).

The full list, oldest first:

| | |
| --- | --- |
| [#221](https://github.com/venn-lang/venn/issues/221) | a verb inside an `if` in a `fn` body was ignored |
| [#222](https://github.com/venn-lang/venn/issues/222) | a list literal was checked against its first element |
| [#223](https://github.com/venn-lang/venn/issues/223) | a block body could not return a value or nothing |
| [#224](https://github.com/venn-lang/venn/issues/224) | `repeat n as i` counted from 1 at the top and from 0 in a `fn` |
| [#227](https://github.com/venn-lang/venn/issues/227) | a decorator written in an imported file was silently dropped |
| [#228](https://github.com/venn-lang/venn/issues/228) | a block-bodied `fn` as a call argument did not parse |
| [#229](https://github.com/venn-lang/venn/issues/229) | a closure in a `deco` body read the file's own names as nothing |
| [#230](https://github.com/venn-lang/venn/issues/230) | a `try` in a `fn` was reported as a verb called `return` |
| [#231](https://github.com/venn-lang/venn/issues/231) | `loop` state advanced on one side only, and hung on the other |
| [#232](https://github.com/venn-lang/venn/issues/232) | `repeat` and `forEach` passed a bad value in silence inside a `fn` |
| [#233](https://github.com/venn-lang/venn/issues/233) | a map interpolated into text read `[object Object]` |
| [#234](https://github.com/venn-lang/venn/issues/234) | two lists are never `==`, and nothing said so |
| [#235](https://github.com/venn-lang/venn/issues/235) | `res.time` was always 0 |
| [#236](https://github.com/venn-lang/venn/issues/236) | a `fn`'s declared return type did not reach a list literal |
| [#237](https://github.com/venn-lang/venn/issues/237) | two instants could not be subtracted |
| [#238](https://github.com/venn-lang/venn/issues/238) | narrowing did not reach a guard clause |
| [#239](https://github.com/venn-lang/venn/issues/239) | a refused connection reported `fetch failed` |
