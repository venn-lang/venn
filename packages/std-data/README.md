# @venn-lang/data

> The `data` namespace: 96 deterministic faker verbs, plus picking, shuffling and parsing.

Test data that changes between runs makes a failure impossible to reproduce. Every value this
package draws comes from the run's own `Random`, the stream `math.random` draws from, which the
runner hands back at the start of every flow. So a flow replays the same person, the same card
number and the same CPF whether it ran alone, after another flow or under `--flow`. That stream
is a port, so `data` asks the host for the `random` capability and nothing else: no network and
no clock.

## Install

The package is part of the stdlib the `venn` CLI loads, so nothing to install. Reach it from a
flow with an `import` line:

```ruby
import { data } from "venn/data"
```

## Usage

```ruby
module demo.signup

import { contains } from "venn/assert"
import { data } from "venn/data"

flow "A generated Brazilian signup" {
  const name = data.faker.name
  const email = data.faker.email
  const cpf = data.faker.br.cpf
  const card = data.faker.creditCard

  step "the generated person is plausible" {
    expect name contains " "
    expect email contains "@"
    expect cpf contains "-"
    expect card contains " "
  }

  step "and the rest of the namespace is there too" {
    const plan = data.oneOf "free" "pro"
    const roll = data.range 1 10
    const rows = data.csv "name,plan\nada,pro\nlinus,free"

    expect roll >= 1
    expect rows.len == 2
  }
}
```

## Verbs

Five verbs sit directly on the namespace:

| Verb | Gives back | Notes |
| --- | --- | --- |
| `data.oneOf a b c…` | `dynamic` | One of the positional arguments. |
| `data.range min max` | `number` | An integer in the inclusive range. |
| `data.shuffle values` | `list<dynamic>` | A permutation. The input array is left alone. |
| `data.csv text` | `list<data.Row>` | Parses inline CSV; the first line names the columns. |
| `data.json text` | `dynamic` | `JSON.parse`, with the shape left to the caller. |

The other 96 are `data.faker.*`, grouped by what a form asks for:

| Family | Verbs |
| --- | --- |
| Person | `firstName` `lastName` `name` `fullName` `prefix` `suffix` `gender` `jobTitle` `age` `birthDate` `phone` |
| Internet | `email` `username` `password` `domain` `url` `ipv4` `ipv6` `mac` `port` `userAgent` `slug` `httpMethod` `httpStatus` `mimeType` |
| Address | `street` `streetAddress` `address` `buildingNumber` `city` `country` `countryCode` `zip` `latitude` `longitude` `timezone` |
| Company | `company` `department` `catchPhrase` `buzzword` |
| Commerce | `product` `productName` `sku` `barcode` `category` `material` `color` `hexColor` `price` |
| Finance | `creditCard` `cardType` `cvv` `expiryDate` `iban` `bic` `accountNumber` `currencyCode` `currencySymbol` `currencyName` `amount` |
| Date and time | `date` `dateTime` `pastDate` `futureDate` `time` `timestamp` `weekday` `month` `year` |
| Text | `word` `words` `sentence` `sentences` `paragraph` `paragraphs` `title` |
| Identifiers | `uuid` `nanoid` `objectId` `hex` `token` `alphanumeric` `digits` `int` `float` `boolean` |
| Brazil | `br.cpf` `br.cnpj` `br.cep` `br.phone` `br.plate` `br.street` `br.address` `br.city` `br.state` `br.stateCode` |

Ten of them read positional bounds; the rest take nothing.

```ruby
import { data } from "venn/data"

const pin      = data.faker.digits 4        # four decimal digits
const quantity = data.faker.int 1 6         # inclusive on both ends
const blurb    = data.faker.words 5
const born     = data.faker.year 1980 2005
```

The full list of verbs that read arguments: `nanoid(length)`, `hex(length)`,
`alphanumeric(length)`, `digits(length)`, `int(min, max)`, `float(min, max)`, `words(count)`,
`sentences(count)`, `paragraphs(count)`, `year(from, to)`. All arguments are optional and every
one has a default.

### Check digits are real

A value a form rejects before it reaches the server is useless in a test, so the generators that
carry a checksum compute it: `creditCard` passes Luhn, `barcode` passes the EAN-13 check, `iban`
passes mod-97, and `br.cpf` and `br.cnpj` carry the digits a Brazilian form validates.

## API

| Export | What it is |
| --- | --- |
| `dataPlugin` (also the default export) | The `PluginDefinition` for the `data` namespace. |
| `dataActions` | The `ActionDefinition[]` behind it, faker verbs included. |
| `allFakerSpecs`, `FakerSpec` | The catalogue as data: `name`, `doc`, a `TypeSpec` result, optional `args`, and `make(rng, args)`. |
| `rngFrom(ctx)`, `Rng` | The run's stream, read from `ctx.port(RandomPort)`, as the draw every generator takes. |
| `shuffleWith(items, rng)` | Fisher-Yates against a given PRNG. Returns a new array. |
| `parseCsv(content)`, `CsvRow` | The splitter behind `data.csv`. |
| `uuid`, `email`, `firstName`, `lastName`, `fullName` | Single generators, each taking an `Rng`. |
| `cpfDigits`, `cnpjDigits`, `luhnDigit`, `eanDigit`, `ibanCheck` | The check-digit functions on their own. |
| `ANCHOR` | The fixed instant the date verbs are drawn around, `2025-01-01T00:00:00Z`. |

The plugin publishes one named type, `data.Row`: a map of string to string, which is what
`data.csv` gives back per record.

## Determinism

Every verb draws from the run's `Random`, which the host seeds and the runner restarts at the
start of every flow. So the sequence of calls *a flow* makes is what determines its values, not
the wall clock and not what another flow drew before it. Driving the catalogue by hand takes any
`Random`, which is how the tests here assert that the whole of it replays identically:

```ts
import { createSeededRandom } from "@venn-lang/contracts";
import { allFakerSpecs } from "@venn-lang/data";

const draw = () => {
  const random = createSeededRandom({ seed: 1 });
  return allFakerSpecs.map((spec) => spec.make(() => random.next(), []));
};
// `draw()` equals `draw()`: the same 96 values, in the same order
```

Dates are drawn around `ANCHOR` rather than `Date.now()`, for the same reason.

## Limits

`parseCsv` is a minimal splitter: it reads inline content only (no file paths yet), splits on
commas and trims cells, and does not handle quoted commas.

## See also

- [`@venn-lang/crypto`](../std-crypto) for hashing and signing the values generated here.
- [`@venn-lang/mock`](../std-mock) for freezing the clock and flipping flags.
- [`@venn-lang/sdk`](../sdk) for `defineAction` and `definePlugin`.
