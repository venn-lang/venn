# @venn-lang/json

> The `json` namespace: text in, a value out, with the position when it is not JSON.

A response body, a fixture on disk, a line off a pipe: all of them arrive as text. This is the
half that reads one. Writing a value back out is [`fmt.json`](../std-fmt), and neither namespace
knows how to do the other's job.

## Install

`@venn-lang/json` is part of the stdlib the `venn` CLI and the language server load, so there is
nothing to install. A file that uses it says so:

```ruby
import { json } from "venn/json"
```

Every verb is pure, so the plugin requires no host capability and runs anywhere the language does,
the editor included.

## Usage

```ruby
import { json } from "venn/json"

type Order { id: number, total: number }

# What comes back is `dynamic`: text says nothing about its own shape. The
# annotation is what gives it one, and what makes `order.totl` a compile error.
const order: Order = json.parse(res.body)
print order.total

# For text nobody promised was JSON.
const maybe = json.tryParse(line)
if maybe == null {
  io.eprint "that line was not JSON"
}
```

## Verbs

| Verb | Signature | What it does |
| --- | --- | --- |
| `json.parse` | `(string) -> dynamic` | Reads JSON text into a value. Fails, naming where, when it is not JSON. |
| `json.tryParse` | `(string) -> dynamic` | The same, answering `null` instead of failing. |
| `json.isValid` | `(string) -> bool` | Whether the text is JSON at all, without keeping what it says. |

`parse` and `tryParse` are two spellings of one question because reading text that turns out not to
be JSON is the everyday case, not a surprise. One fails where it is written; the other hands the
decision back.

## When it is not JSON

The message is about the text, not about a parser:

```
This is not JSON: Expected property name or '}', at line 1 column 3.
```

Where the runtime names a position, the line and column are what appear, because an offset is a
number nobody can find in a file. Where it does not, the text around the failure is quoted instead.

## API

| Export | What it is |
| --- | --- |
| `jsonPlugin` (also the default export) | The `PluginDefinition`: namespace `json`, no capability required. |
| `jsonActions` | The three `ActionDefinition`s, in the order listed above. |
| `parseJson` | The reader itself, answering `{ ok, value }` or `{ ok, reason }` rather than throwing. |

```ts
import { parseJson } from "@venn-lang/json";

parseJson('{ "a": 1 }'); // { ok: true, value: { a: 1 } }
parseJson("{"); // { ok: false, reason: "Expected property name or '}', at line 1 column 2" }
```

## See also

- [`@venn-lang/fmt`](../std-fmt) for the other direction: a value into JSON, a table, YAML, CSV or XML.
- [`@venn-lang/io`](../std-io) for where the text usually comes from.
