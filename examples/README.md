# Examples

Every file here runs. They are checked in CI the same way you would run them, so
if one stops working it is a bug in Venn, not in the example.

```bash
venn check examples/                      # type-check all 84 at once
venn run   examples/basics/01-hello.vn    # a program: statements, top to bottom
venn test  examples/testing/01-first-flow.vn   # a test: runs the flow blocks
```

`run` executes statements and `test` runs `flow` blocks. A file containing a
`flow` does nothing under `run`, which is the one thing worth knowing before you
start.

## Sections

Read them in this order. Each assumes the one before it.

| section | what it covers | how to run |
| --- | --- | --- |
| [`basics/`](basics) | The whole language before any plugin: values, text, functions, control flow, lists, maps, and units such as `300ms` and `2mb`. | `venn run` |
| [`language/`](language) | Types, decorators written in Venn, modules and `pub`, alias imports, fragments. | `venn run`, one `venn test` |
| [`testing/`](testing) | A first `flow` through to lifecycle hooks, expected failure, concurrency and matrices. | `venn test` |
| [`servers/`](servers) | Starting a real HTTP server and asserting against it in the same file. | `venn run`, one `venn test` |
| [`algorithms/`](algorithms) | Venn away from testing: fibonacci, sorting, binary search, word frequency, primes. | `venn run` |
| [`programs/`](programs) | Whole programs rather than features, one folder each with its modules and its tests: a Pokedex, a status board, an expense report, a gradebook, a rota across timezones, a pantry. | `venn run`, `venn test` |

## Where to start

- **Never seen Venn**: [`basics/01-hello.vn`](basics/01-hello.vn).
- **Here to write tests**: [`testing/01-first-flow.vn`](testing/01-first-flow.vn).
- **Wondering what the language is like to think in**: [`algorithms/`](algorithms).
- **Wondering whether you could write something real in it**: [`programs/`](programs).

## Notes

Everything runs offline except one: [`programs/pokedex/`](programs/pokedex) talks
to the real PokeAPI, deliberately, and its tests do not. [`servers/`](servers)
and the rest of [`programs/`](programs) only talk to themselves on localhost,
binding to port 0 so the operating system picks a free one and nothing clashes.

These files are documentation and CI runs every one of them, through `run` or
through `test`, comparing what each prints against
[`scripts/examples-expected.json`](../scripts/examples-expected.json). A better
example is still welcome: write it, then run `node scripts/examples-run.mjs
--write` so the change lands with what it now prints.
