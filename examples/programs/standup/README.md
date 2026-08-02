# Standup

Whose turn it is to run standup, and when that lands where each person is.

```bash
venn run  examples/programs/standup/main.vn
venn test examples/programs/standup/tests.vn
```

```
when       │ host  │ ana   │ bruno │ cleo
───────────┼───────┼───────┼───────┼──────
2026-08-03 │ ana   │ 10:00 │ 06:00 │ 18:00
2026-08-10 │ bruno │ 10:00 │ 06:00 │ 18:00
2026-08-17 │ cleo  │ 10:00 │ 06:00 │ 18:00

a zone nobody has: There is no timezone called Mars/Olympus. (VN7005)

after 2026-08-20, next is ana on 2026-08-24
```

## The files

| file | what is in it |
| --- | --- |
| [`main.vn`](main.vn) | The program: six meetings, printed. |
| [`rota/schedule.vn`](rota/schedule.vn) | The team, the rota, and the arithmetic. Pure. |
| [`rota/mod.vn`](rota/mod.vn) | The face of the folder. |
| [`tests.vn`](tests.vn) | Twenty assertions, and no clock. |

## What it is about

Arithmetic that is trivial until timezones are in it. One instant, three wall
clocks, and every person needs the one they will actually read.

**A place, not an offset.** The team carries IANA names because an offset changes
twice a year and a place does not.

**A week is `168h`, not `7d`.** The units stop at the hour, and that is the right
place to stop: a day is not a fixed length where clocks change, so `7d` would be
a lie twice a year in two of these three zones.

**A name nobody recognises ends the run.** `date.in` and `date.format` now agree
about that, which they did not before this milestone: one refused and the other
answered with nothing, so the same mistake produced an error or an empty cell
depending on which verb you happened to call.

**The team list is the rota.** Adding a person changes who hosts and nothing
else, because the wrap is arithmetic on the list rather than a table somebody has
to remember to extend. Two of the twenty assertions are about exactly that.
