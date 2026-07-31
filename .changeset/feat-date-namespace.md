---
"@venn-lang/date": minor
"@venn-lang/stdlib": minor
---

What a moment cannot know alone: the time now, a pattern, and a place on earth.

```venn
import { date } from "venn/date"

const started = date.now()
print date.format(started, "YYYY-MM-DD HH:mm")
print date.format(started, "HH:mm", "America/Sao_Paulo")
```

`date.now()` asks the run's own clock, so a test binds a virtual one and decides
what time it is, which is the difference between a suite that can test an expiry
and one that has to wait for it.

Timezones are named, never assumed. Everything a moment answers about itself is
UTC, and every verb that could mean somewhere else takes the place as an
argument, because reading a date in the machine's own zone is how a suite passes
in one office and fails in another. A zone the runtime does not know is refused
rather than quietly answered in UTC.

The zones come from the runtime's own table through `Intl`. Doing that arithmetic
here would mean shipping a copy of it and watching it go out of date.
