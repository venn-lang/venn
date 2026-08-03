# @venn-lang/math

> The `math` namespace: the constants and functions a number has no member for.

A number answers plenty about itself: `x.abs`, `x.sqrt`, `x.round(2)`, `x.clamp(0, 100)`. What is
here is what is left over. A constant has no receiver at all, and `atan2(y, x)` takes two numbers
neither of which is the subject.

## Install

Part of the stdlib the `venn` CLI and the language server load. A file that uses it says so:

```ruby
import { math } from "venn/math"
```

## Usage

```ruby
import { math } from "venn/math"

const radius = 3
const area = math.pi * radius.pow(2)

const x = 1
const y = 1
const angle = math.atan2(y, x)
const degrees = math.degrees(angle)

# From the run's own source, so the same run draws the same numbers twice.
const roll = math.randomInt(1, 6)
```

## What it has

**Constants**, read as values rather than called: `math.pi`, `math.tau`, `math.e`, `math.epsilon`,
`math.infinity`, `math.nan`. Each can be imported on its own, since a constant is a value like any
other:

```ruby
import { pi, tau } from "venn/math"
```

**Trigonometry**: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, and `atan2(y, x)`, which is the one
`atan` cannot do alone. `degrees` and `radians` convert between the two ways of saying an angle.

**Logarithms**: `log` (natural), `log2`, `log10`, and `exp`.

**Two numbers**: `hypot(a, b)` without the overflow of squaring first, `gcd(a, b)`, `lcm(a, b)`.

**The rest of the arithmetic**: `trunc` (toward zero, unlike `floor`), `cbrt`, `factorial`,
`min(a, b)` and `max(a, b)` for two numbers, since a list already answers `.min` about itself, and
`sinh`, `cosh`, `tanh`.

**Questions a number cannot answer about itself**: `isNaN`, `isFinite`, and `isClose(a, b, within)`.
`nan` is the reason the first one has to be a verb: it equals nothing, itself included, so
`x == math.nan` is false however wrong the sum went.

`isClose` scales its tolerance with the numbers unless one is given, because a fixed difference is
wrong at both ends: everything is within `0.001` of a billion, and nothing is within it of a
millionth.

**Randomness**: `random()` for a number from 0 up to 1, and `randomInt(from, to)` with both ends
included.

## What it does not have

`abs`, `floor`, `ceil`, `round`, `sign`, `sqrt`, `pow` and `clamp` are **members of a number**:

```ruby
print (-3).abs        # 3
print 2.sqrt          # 1.4142135623730951
print 3.7.round(0)    # 4
print 140.clamp(0, 100)
```

They read better that way, and a second spelling would be a second way to say one thing. A test in
this package fails if any of them ever appears here.

## Randomness comes from the run

`math.random()` asks the host's source through the `Random` port, rather than reaching for
`Math.random`. The host binds a seeded one, so a run draws the same numbers every time and a failure
can be replayed. A plugin that reached for the global generator would take that away from every test
that used it.

## API

| Export | What it is |
| --- | --- |
| `mathPlugin` (also the default export) | The `PluginDefinition`: namespace `math`, no capability required. |
| `constants` | The four `ValueDefinition`s. |
| `functions` | Trigonometry, logarithms and the two-argument ones. |
| `randomActions` | `random` and `randomInt`, both through the port. |

## See also

- [`@venn-lang/data`](../std-data) for generated values: names, emails, a shuffled list.
- [`@venn-lang/contracts`](../contracts) for the `Random` port and its two implementations.
