---
"@venn-lang/math": minor
"@venn-lang/sdk": minor
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/stdlib": minor
---

The constants and functions a number has no member for.

```venn
import { math } from "venn/math"

const area = math.pi * radius.pow(2)
const angle = math.atan2(y, x)
const roll = math.randomInt(1, 6)
```

Trigonometry, logarithms, `hypot`, `gcd`, `lcm`, and randomness that comes from
the run's own seeded source rather than from `Math.random`, so a failure can be
replayed. What a number already answers about itself stays a member: `x.abs`,
`x.sqrt`, `x.round(2)`, and a test in the package fails if any of them ever
appears here as well.

A plugin can publish a **value** now, not only a verb. A constant written as a
verb with no arguments would have to be called, and read without the brackets it
hands back the verb itself; `math.pi` is data, and is read as the number it is.
The checker knows its type, so `const x: string = math.pi` is refused where it is
written.

The host's own capabilities are bound as ports, so a plugin can ask for the run's
clock, its random or its filesystem. Anything the caller binds by hand still
wins.
