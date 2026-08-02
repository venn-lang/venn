# Watchtower

Asks a list of services whether they are alive, all at once, and prints a board.

```bash
venn run examples/programs/watchtower/main.vn
venn run examples/programs/watchtower/main.vn https://example.com https://example.com/nope
venn test examples/programs/watchtower/tests.vn
```

```
service  │ status │ verdict
─────────┼────────┼────────
checkout │ 200    │ up
billing  │ 503    │ failing
search   │ -      │ down

1 up, 1 failing, 1 down

billing: the service answered badly
search: fetch failed

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

## What writing it found

- [#237](https://github.com/venn-lang/venn/issues/237): two instants cannot be
  subtracted, so nothing in the language can answer "how long did that take".
  It is why this reports which services answered rather than how quickly, which
  is the first thing a real watchtower would show.
- [#238](https://github.com/venn-lang/venn/issues/238): narrowing does not reach
  a guard clause and does not survive into a `return`'s expression, which is why
  `verdictOf` is nested two levels deeper than it wants to be.
- [#239](https://github.com/venn-lang/venn/issues/239): a connection that was
  refused reports `fetch failed`, which is the platform's words rather than the
  product's. It is the `search` row above.
