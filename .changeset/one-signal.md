---
"@venn-lang/contracts": minor
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/project": minor
"@venn-lang/cli": minor
---

`@timeout`, `race`, `parallel` and `forEach` cancel by one mechanism, and what
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
