# Programs

Five programs rather than five demonstrations. Each one does a job somebody
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

Every folder has a `tests.vn`. Together they are 110 assertions written in Venn
against programs written in Venn:

```bash
venn test examples/programs/pokedex/tests.vn      # 22
venn test examples/programs/watchtower/tests.vn   # 30
venn test examples/programs/ledger/tests.vn       # 18
venn test examples/programs/gradebook/tests.vn    # 20
venn test examples/programs/standup/tests.vn      # 20
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
`watchtower/watch/verdict.vn` against `watchtower/watch/probe.vn`.

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

## Everything runs offline except one

[`pokedex/main.vn`](pokedex/main.vn) talks to the real
[PokeAPI](https://pokeapi.co), deliberately: an example of talking to somebody
else's service that talks to nobody is not an example of anything. Its tests do
not, and neither does anything else here. [`watchtower/`](watchtower) given no
arguments stands three services of its own up and watches those.

## What writing them found

Thirteen bugs, and they are the reason these programs exist. Four have been fixed
and are in the language now:

- [#221](https://github.com/venn-lang/venn/issues/221): a verb inside an `if` in
  a `fn` body was ignored, and the function returned `null` instead of its value.
- [#222](https://github.com/venn-lang/venn/issues/222): a list literal was
  checked against its first element rather than against the type its binding
  declared.
- [#223](https://github.com/venn-lang/venn/issues/223): a block body could not
  return a value or nothing, which is the ordinary answer of anything that looks
  something up.
- [#224](https://github.com/venn-lang/venn/issues/224): `repeat n as i` counted
  from 1 at the top of a file and from 0 inside a `fn`.

Nine are open, and where a program here is shaped around one of them, the
comment beside it says which:

| | |
| --- | --- |
| [#227](https://github.com/venn-lang/venn/issues/227) | a decorator written in an imported file is silently dropped |
| [#228](https://github.com/venn-lang/venn/issues/228) | a block-bodied `fn` as a call argument does not parse |
| [#229](https://github.com/venn-lang/venn/issues/229) | a closure in a `deco` body cannot see the file's own names |
| [#233](https://github.com/venn-lang/venn/issues/233) | a map interpolated into text reads `[object Object]` |
| [#234](https://github.com/venn-lang/venn/issues/234) | two lists are never `==`, and nothing says so |
| [#235](https://github.com/venn-lang/venn/issues/235) | `res.time` is always 0 |
| [#237](https://github.com/venn-lang/venn/issues/237) | two instants cannot be subtracted |
| [#238](https://github.com/venn-lang/venn/issues/238) | narrowing does not reach a guard clause |
| [#239](https://github.com/venn-lang/venn/issues/239) | a refused connection reports `fetch failed` |
