---
"@venn-lang/sdk": minor
"@venn-lang/runtime": minor
"@venn-lang/assert": minor
---

One renderer behind a failing check.

`print` and `"${…}"` share a definition, and so does `io.print`. A failure title
did not: `@venn-lang/assert` carried a renderer of its own, with its own rule
against `[object Object]`, its own quoting and its own fallback to JSON. So
`print row` gave `{ status: "pending" }` and the red check on the next line gave
`{"status":"pending"}`, and a duration read as `{"kind":"duration","ms":300}`
where the print above said `300ms`. It is the worst place for a second answer,
because a failure is read by somebody who already does not understand what
happened.

The renderer lives in `@venn-lang/core`, which a plugin may not depend on, so
the runtime hands it over, as it already does for actions. `MatcherContext`
gains `show(value)`, required for the same reason it is required on
`ActionContext`: an optional member reads as an invitation to write the fallback
that becomes the second definition. `message` and `detail` receive the context
as a second argument. `test` does not: a verdict is reached by comparing values,
and a matcher holding a renderer while deciding one is a matcher that can
compare their text instead.

What `@venn-lang/assert` still decides is width, not shape. A title is one line,
so a side past that budget is cut where it stands and marked with `…`, rather
than rewritten into prose about the value's shape. A string on the line is
quoted, the one place a value reads differently from a value on its own, because
`expect "200" equals 200` failing with `expected 200 to equal 200` is a line
nobody can act on.
