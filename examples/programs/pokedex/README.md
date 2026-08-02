# Pokedex

A command-line Pokedex. Give it names and it prints a table comparing them; give
it nothing and it sits at a prompt.

```bash
venn run examples/programs/pokedex/main.vn pikachu eevee snorlax
venn run examples/programs/pokedex/main.vn
venn test examples/programs/pokedex/tests.vn
```

```
no  │ name    │ type     │ hp  │ attack │ speed
────┼─────────┼──────────┼─────┼────────┼──────
025 │ Pikachu │ Electric │ 35  │ 55     │ 90
133 │ Eevee   │ Normal   │ 55  │ 55     │ 55
143 │ Snorlax │ Normal   │ 160 │ 110    │ 30

hp      Snorlax (160)
attack  Snorlax (110)
speed   Pikachu (90)
```

At the prompt, a bare name prints one card, `team a b c` compares several, and
`quit` leaves.

## This one needs a network

It talks to the real [PokeAPI](https://pokeapi.co). Everything else under
`examples/` runs offline, so this is the exception, and it is deliberate: an
example of talking to somebody else's service that talks to nobody is not an
example of anything.

`tests.vn` needs no network. It stands a server of its own up on a port the
operating system picks, teaches it to answer the way PokeAPI answers, and hands
its address to the same fragments the program uses.

## The files

| file | what is in it |
| --- | --- |
| [`main.vn`](main.vn) | The program: arguments, the prompt, and every word a person reads. |
| [`dex/entry.vn`](dex/entry.vn) | What a Pokemon is. Pure, and it does not know what a screen is. |
| [`dex/fetch.vn`](dex/fetch.vn) | The only file that touches the network. |
| [`dex/shape.vn`](dex/shape.vn) | Three decorators this program wrote for itself. |
| [`dex/mod.vn`](dex/mod.vn) | The face of the folder. |
| [`tests.vn`](tests.vn) | Twenty-two assertions, no network. |

The split is the one the language already draws. A `fn` is pure and cannot make
a request, a `fragment` can, so `entry.vn` is what the dex knows and `fetch.vn`
is where it finds out. Nothing had to be decided to arrive at that boundary; it
was already there.

## What it leans on

**A team is fetched at once.** `lookupAll` runs the requests four at a time:

```ruby
forEach one in numbered(names) { concurrency: 4 } {
  try {
    run lookup(base, one.name) as entry
    found = found.push({ at: one.at, entry: entry })
  } catch e {
    missing = missing.push({ at: one.at, name: one.name, why: e.message })
  }
}
```

Six names cost about as much as the slowest one rather than the sum of six. What
that costs is arrival order, so each name carries the position it was asked in
and the answers are put back in that order at the end. A report whose rows moved
between runs would be a report nobody could diff.

One name failing does not take the others with it. A team of six with a typo in
it is still five Pokemon worth showing, so the refusal is caught per name and
handed back beside the ones that worked.

**Failure has a code.** `lookup` refuses with `dex.unknown` for a name that does
not exist and `dex.unavailable` for a service that is down, so a caller can tell
the person's mistake from the network's without reading the sentence.

**Three decorators, each because the same rule was about to be written four
times.** `@named` capitalises, `@joined(" / ")` writes a list out as text, and
`@instead(0)` fills in for a Pokemon with no stats at all. They are rules about
the answer rather than about the work, which is the kind of rule that reads
better above a function than inside it.

**One loop serves a person and a pipe.** `io.ask` writes the question and reads
the answer, and through a pipe it reads the piped line and answers nothing once
there are none left. So this works:

```bash
printf 'pikachu\nteam eevee snorlax\nquit\n' | venn run examples/programs/pokedex/main.vn
```

and nothing in `prompt()` asks which of the two it is talking to.

## What writing it found

Four bugs, all open:

- [#227](https://github.com/venn-lang/venn/issues/227): a decorator written in an
  imported file is silently dropped. It is why the display functions live in
  `main.vn` rather than beside the data they format, which is where they belong.
- [#228](https://github.com/venn-lang/venn/issues/228): a block-bodied `fn`
  written directly as a call argument does not parse once its block holds a
  statement.
- [#233](https://github.com/venn-lang/venn/issues/233): a map interpolated into
  text reads `[object Object]`.
- [#234](https://github.com/venn-lang/venn/issues/234): two lists are never
  `==`, and nothing says so. It cost four assertions in `tests.vn` that looked
  like they held.
