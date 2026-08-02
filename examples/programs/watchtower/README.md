# Watchtower

Asks a list of services whether they are alive, all at once, and prints a board.

```bash
venn run examples/programs/watchtower/main.vn
venn run examples/programs/watchtower/main.vn https://example.com https://example.com/nope
venn test examples/programs/watchtower/tests.vn
```

```
service  │ status │ took │ verdict
─────────┼────────┼──────┼────────
checkout │ 200    │ 27ms │ up
billing  │ 503    │ 22ms │ failing
search   │ -      │ -    │ down

1 up, 1 failing, 1 down
slowest to answer: checkout at 27ms

billing: the service answered badly
search: Nothing is listening on 127.0.0.1:59999, so GET http://127.0.0.1:59999/health was refused.

mirrors: eu-west answered first with 200
```

Given addresses it watches those. Given none it stands three services of its own
up, one healthy, one broken and one that is not listening at all, and watches
those. So the demonstration runs offline and the program is still a real one:
nothing in the checking knows which of the two it is doing.

## The files

| file | what is in it |
| --- | --- |
| [`main.vn`](main.vn) | Arguments, the board, and the services it stands up when given none. |
| [`watch/probe.vn`](watch/probe.vn) | The only file that touches the network. |
| [`watch/verdict.vn`](watch/verdict.vn) | What an answer means. Pure. |
| [`watch/mod.vn`](watch/mod.vn) | The face of the folder. |
| [`tests.vn`](tests.vn) | Thirty assertions, against servers it stands up itself. |

## What it leans on

**Three ways of doing several things at once, and they are not the same word by
accident.**

`forEach { concurrency: n }` is the board: the same question asked of many
services, a few at a time, with a cap because eight in flight is polite against
a fleet and rude against one box.

```ruby
forEach one in numbered(watches) { concurrency: atOnce } {
  run probe(one.watch) as result
  done = done.push({ at: one.at, result: result })
}
```

`parallel { onError: "collect" }` is different work running together, and
`collect` lets the siblings finish and reports every failure rather than
cancelling them all at the first. For a status board that is the only setting
that makes sense: cancelling the rest of the sweep because one service is down
is exactly backwards.

`race` is the mirror pair. It keeps the branch that settles first and stops the
other at its next statement boundary, because the question a mirror asks is
whether *anybody* is serving, and waiting for the slower one to agree buys
nothing.

**Order survives the concurrency.** Each service carries the position it was
asked in and the answers are put back in that order at the end. A board whose
rows moved between runs would be a board nobody could compare, and comparing
this morning's to last night's is the whole job.

**A probe never refuses.** A watchtower whose own check throws stops at the
first service that is down, which is the one moment it exists for. So a refusal
becomes a result with no status:

```ruby
try {
  const res = http.get one.url
  return { name: one.name, url: one.url, status: res.status, note: reason(res) }
} catch e {
  return { name: one.name, url: one.url, status: null, note: e.message }
}
```

**Three verdicts rather than two.** A service that answered 500 and a service
that answered nothing are told apart on purpose. The first is running and wrong,
the second is not running, and whoever is woken at four in the morning needs to
know which. It is the distinction the whole report turns on, and it is why
`status` is `number | null` rather than a number with a sentinel in it.

It is also why the slowest line drops anything that never answered rather than
counting it as instant, and why the `took` column is a dash there. A zero would
have made the dead service the fastest one on the board.

## What writing it found

Three bugs, all three since fixed, and all three visible in the output above.

- [#235](https://github.com/venn-lang/venn/issues/235) and
  [#237](https://github.com/venn-lang/venn/issues/237): `res.time` was always
  zero, and two instants could not be subtracted, so nothing in the language
  could answer "how long did that take". The `took` column and the slowest line
  are what those two bought.
- [#238](https://github.com/venn-lang/venn/issues/238): narrowing did not reach
  a guard clause and did not survive into a `return`'s expression, so
  `verdictOf` was nested two levels deeper than it wanted to be. It is now the
  guard and one line behind it.
- [#239](https://github.com/venn-lang/venn/issues/239): a refused connection
  reported `fetch failed`, the platform's words rather than the product's. The
  `search` row now names the address and carries `VN7022`, so a caller can tell
  a service that is down from one that is wrong without reading the sentence.
