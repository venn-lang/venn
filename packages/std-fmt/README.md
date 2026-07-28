# @venn/fmt

> The `fmt` namespace: a value in, formatted text out. JSON, tables, YAML, CSV and XML.

Formatting is kept separate from printing on purpose. Every verb here returns a `string`, which is a
value you can print, assert against, send in a request or write to a file, not something that only
ever reaches a terminal. The plugin is pure: it needs no host capability and touches nothing.

## Install

`@venn/fmt` is part of the stdlib the `venn` CLI and the language server load, so there is nothing
to install. A file that formats says so:

```ruby
use "@venn/fmt"
```

## Usage

```ruby
# report.vn, run with `venn run report.vn`
use "@venn/fmt"

const people = [
  { name: "Ada",   age: 36 },
  { name: "Linus", age: 54 }
]

print fmt.table(people)
print fmt.csv(people)
print fmt.json({ count: people.len }, 0)
```

```
name  │ age
──────┼────
Ada   │ 36
Linus │ 54
name,age
Ada,36
Linus,54
{"count":2}
```

`print` is in the prelude, so that file imports nothing but `fmt`.

## Verbs

| Verb | Signature | What it does |
| --- | --- | --- |
| `fmt.json` | `(dynamic, number?) -> string` | JSON text. Indents by 2 by default; `fmt.json(x, 0)` puts it on one line. A value that contains itself degrades instead of throwing. |
| `fmt.table` | `(list<dynamic>) -> string` | An aligned ASCII table of a list of records. |
| `fmt.yaml` | `(dynamic) -> string` | YAML for a map, a list or a scalar. |
| `fmt.csv` | `(list<dynamic>, string?) -> string` | CSV with a header row. `fmt.csv(rows, ";")` changes the separator. |
| `fmt.xml` | `(dynamic, string?) -> string` | XML text. `fmt.xml(x, "user")` names the root element, which is `root` otherwise. |

Every knob is positional, and every verb ends in a `string`. None of them reads an options map, so
none declares one: an options map in the editor's hover that the verb never looks at would quietly
strip the keys a caller wrote there.

### What each renderer decides

- **`table`** takes the columns from the union of every row's keys, in first-seen order, so a row
  missing a field still lines up. Each column is padded to its widest cell. An empty list renders as
  `(no rows)`.
- **`yaml`** puts a scalar on its key's line and opens an indented block for a map or a list. A
  string that would not read back as plain YAML is quoted, and so is the empty string. An empty list
  is `[]` and an empty map is `{}`.
- **`csv`** follows RFC 4180: a field is quoted only when it holds a separator, a quote or a
  newline, and inner quotes are doubled. A list with no records renders as the empty string.
- **`xml`** turns keys into elements and repeats a tag for each item of a list. Text is escaped
  (`&`, `<`, `>`, `"`), and a map with nothing in it becomes a self-closing element.

## API

| Export | What it is |
| --- | --- |
| `fmtPlugin` (also the default export) | The `PluginDefinition`: namespace `fmt`, five actions, no required capability, no types of its own. |
| `fmtActions` | The five `ActionDefinition`s. |
| `toJson(value, spaces?)` | The renderer behind `fmt.json`. Defaults to 2 spaces. |
| `toTable(rows)` | The renderer behind `fmt.table`. |
| `toYaml(value, indent?)` | The renderer behind `fmt.yaml`. |
| `toCsv(rows, separator?)` | The renderer behind `fmt.csv`. Defaults to a comma. |
| `toXml(value, tag?, indent?)` | The renderer behind `fmt.xml`. Defaults to the tag `root`. |

The renderers are plain functions with no context and no ports, so they are usable on their own:

```ts
import { toCsv, toYaml } from "@venn/fmt";

toCsv([{ text: 'say "hi", now', plain: "ok" }]);
// 'text,plain\n"say ""hi"", now",ok'

toYaml({ name: "Ada", tags: ["a", "b"], nested: { n: 1 } });
// "name: Ada\ntags:\n  - a\n  - b\nnested:\n  n: 1"
```

## See also

- [`@venn/io`](../std-io) for writing the resulting text to standard output or standard error.
- [`@venn/assert`](../std-assert) for asserting on it once it is a string.
- [`@venn/sdk`](../sdk) for `defineAction` and the typed argument helpers used here.
