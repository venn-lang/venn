# @venn-lang/date

> The `date` namespace: building a moment, writing one out, and reading it where somebody stands.

What a moment answers **about itself** is a member of it, in UTC, and lives in the kernel:

<!-- venn-check: a catalogue of members, not a program -->

```ruby
at.year        at.date        at.plus(2h)      at.until(other)      at.isBefore(other)
```

What is here is what a moment cannot know alone: what time it is now, how to write it out, and what
the same instant reads as somewhere else on earth.

## Install

Part of the stdlib the `venn` CLI and the language server load:

```ruby
import { date } from "venn/date"
```

## Usage

```ruby
import { date } from "venn/date"

const started = date.now()
const deadline = started.plus(30m)

print date.format(started, "YYYY-MM-DD HH:mm")
print date.format(started, "HH:mm", "America/Sao_Paulo")

const sent = "2026-07-23T12:00:00Z"
const parsed = date.parse(sent)
if parsed == null {
  fail "the server sent something that is not a date"
}
```

## Verbs

| Verb | Signature | What it does |
| --- | --- | --- |
| `date.now` | `() -> instant` | The moment this run calls now, from the run's own clock. |
| `date.of` | `({ year, month, … }) -> instant` | A moment from its parts, in UTC. |
| `date.parse` | `(string) -> instant \| null` | A moment from text, `null` when the text is not one. |
| `date.format` | `(instant, string, string?) -> string` | Written out by a pattern, in a zone if one is named. |
| `date.in` | `(instant, string) -> { … } \| null` | Its parts where somebody stands. |

**Patterns** are `YYYY`, `YY`, `MM`, `M`, `DD`, `D`, `HH`, `H`, `mm`, `ss`. Anything that is not a
token is written as it stands, so `"on YYYY at HH"` reads back as itself.

## The clock is the run's

`date.now()` asks the `Clock` port, not the machine. A test binds a virtual clock and decides what
time it is, which is the difference between a suite that can test an expiry and one that has to wait
for it.

## Timezones are named, never assumed

Everything a moment answers about itself is UTC, and every verb here that could mean somewhere else
takes the place as an argument:

```ruby
import { date } from "venn/date"

const at = date.parse("2026-07-23T12:00:00Z")

print date.format(at, "HH:mm")                        # 12:00
print date.format(at, "HH:mm", "America/Sao_Paulo")   # 09:00
print date.format(at, "HH:mm", "Asia/Tokyo")          # 21:00
```

Reading a date in the machine's own zone is how a suite passes in one office and fails in another.
A zone the runtime does not know is refused, rather than quietly answered in UTC.

The zones themselves come from the runtime's own table, through `Intl`. Doing the arithmetic here
would mean shipping a copy of that table and watching it go out of date.

## API

| Export | What it is |
| --- | --- |
| `datePlugin` (also the default export) | The `PluginDefinition`: namespace `date`. |
| `dateActions` | The five `ActionDefinition`s. |
| `partsIn` | The parts of a moment in a zone, or nothing when the zone is unknown. |
| `formatParts` | The pattern filler, on parts that were already read. |

## See also

- [`@venn-lang/contracts`](../contracts) for the `Clock` port and its virtual implementation.
- [`@venn-lang/fmt`](../std-fmt) for turning the result into a table or JSON.
