---
"@venn-lang/cli": minor
---

`venn test` leaves the report to the reporter, and a run reads what the packages published.

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
