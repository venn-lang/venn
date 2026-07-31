---
"@venn-lang/math": minor
"@venn-lang/sdk": minor
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/stdlib": minor
"@venn-lang/cli": minor
---

The constants and functions a number has no member for.

```venn
import { math } from "venn/math"
import { pi } from "venn/math"

const area = pi * radius.pow(2)
const angle = math.atan2(y, x)
const roll = math.randomInt(1, 6)
```

Trigonometry, logarithms, `trunc`, `cbrt`, `factorial`, `hypot`, `gcd`, `lcm`,
`min` and `max` of two, the hyperbolic three, and randomness that comes from the
run's own seeded source rather than from `Math.random`, so a failure can be
replayed. What a number already answers about itself stays a member: `x.abs`,
`x.sqrt`, `x.round(2)`, and a test in the package fails if any of them ever
appears here as well.

`nan` brings the questions a number cannot answer about itself, because the
answer is about what it is rather than about its value: it equals nothing, itself
included, so asking has to be a verb. `isNaN`, `isFinite`, and `isClose`, whose
tolerance scales with the numbers unless one is given.

A plugin can publish a **value** now, not only a verb. A constant written as a
verb with no arguments would have to be called, and read without the brackets it
hands back the verb itself; `math.pi` is data, read as the number it is. It can
be imported on its own, since a value is a name like any other, and the checker
types it either way.

The host's own capabilities are bound as ports, so a plugin can ask for the run's
clock, its random or its filesystem. Anything the caller binds by hand still wins.
