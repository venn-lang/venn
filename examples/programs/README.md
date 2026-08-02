# Programs

Four programs rather than four demonstrations. Each one does a job somebody
would otherwise do by hand, and each was written by writing it: the language was
found wanting four times on the way, and every one of those is an issue linked
below rather than a paragraph explaining why the example is shaped oddly.

| program | what it does | run it |
| --- | --- | --- |
| [`ledger.vn`](ledger.vn) | an expense report: claims in, what the company pays out | `venn run examples/programs/ledger.vn` |
| [`gradebook.vn`](gradebook.vn) | weighted marks, grades, and the rows it will not grade | `venn run examples/programs/gradebook.vn` |
| [`standup.vn`](standup.vn) | a rota across three timezones | `venn run examples/programs/standup.vn` |
| [`ledger-tests.vn`](ledger-tests.vn) | the tests for the ledger | `venn test examples/programs/ledger-tests.vn` |

## What each one leans on

**`ledger.vn`** is a folder module. `./ledger` is a directory with a `mod.vn`,
and the program names the directory and nothing inside it. The policy is a
`namespace`: the rate table is private to the block, so a category nobody wrote
down is answered the same way everywhere rather than differently in each place
somebody forgot to check. Reading the claims is `try … else`, because text
nobody promised was JSON is data being ordinary.

**`gradebook.vn`** is about bad data. A term's marks arrive from four teachers
and one of them typed 110, and another left a component out. The pure part
answers with what is wrong, and the program is what refuses: `fail` with a code
of its own, caught where the report is written, so a caller can tell a typo from
a missing mark without reading the message.

**`standup.vn`** is arithmetic that is trivial until timezones are in it. One
instant, three wall clocks. `date.in` and `date.format` now agree that a name
which is not a timezone ends the run, which they did not before this milestone.

**`ledger-tests.vn`** is the language doing what it was built for, against code
written in the language: `flow`, `step`, `fragment` and `expect` over the same
folder the program imports.

## What writing them found

Four bugs, all of them things a person would hit on their first afternoon, and
all four since fixed. The programs below are written the way they wanted to be
written in the first place:

- [#221](https://github.com/venn-lang/venn/issues/221): a verb inside an `if` in
  a `fn` body was ignored, and the function returned `null` instead of its value.
  This one cost a debugging session: a refusal that never happened, in a file
  that checked clean. A body is pure at every depth now, so the same line is a
  parse error wherever it sits.
- [#222](https://github.com/venn-lang/venn/issues/222): a list literal was
  checked against its first element rather than against the type the binding
  declared, so a list of records whose fields differ row by row was refused. The
  gradebook now writes its rows as the list literal they are.
- [#223](https://github.com/venn-lang/venn/issues/223): a block body could not
  return a value or nothing, which is the ordinary answer of anything that looks
  something up. Its `return`s make a union now, the way a `try`'s two sides do.
- [#224](https://github.com/venn-lang/venn/issues/224): `repeat n as i` counted
  from 1 at the top of a file and from 0 inside a `fn`. It counts the passes from
  one in both, so the rota no longer starts a week late.
