# @venn-lang/assert

> The words that follow `expect`: `equals`, `contains`, `oneOf` and `closeTo`.

`expect` belongs to the kernel; the vocabulary does not. This plugin registers four matchers, each
carrying its own one-line failure message and the two values it compared. A red assertion therefore
prints a sentence a person can read plus a structured diff, never `[object Object]`. The plugin
contributes no verbs, declares no types and needs no host capability.

## Install

`@venn-lang/assert` is part of the stdlib the `venn` CLI and the language server load, so there is
nothing to install. A file that asserts brings the namespace in:

```ruby
import { assert } from "venn/assert"
```

A matcher used without that line is `VN2007`; a word no plugin registered is `VN2004`. Both are
reported by `venn check`, before anything runs.

## Usage

```ruby
module demo.matchers

import { closeTo, contains, equals, oneOf } from "venn/assert"

flow "Bareword matchers" {
  step "checks" {
    let plan = "pro"
    let total = 99.005
    expect plan oneOf ["free", "pro"]
    expect "Total: $99.00" contains "$99.00"
    expect total closeTo 99.0 { within: 0.01 }
    expect plan equals "pro"
    expect not plan oneOf ["a", "b"]
  }
}
```

Matchers are barewords: they resolve by name alone, not through the `assert.` prefix. The namespace
is what the `import` line brings into the file.

## Matchers

| Matcher | Written as | Passes when |
| --- | --- | --- |
| `equals` | `expect res.status equals 200` | The two values are structurally the same. No coercion: `"200"` never equals `200`. |
| `contains` | `expect body contains "$99.00"` | The subject is a string holding that substring, or a list holding that item. Anything else fails. |
| `oneOf` | `expect plan oneOf ["free", "pro"]` | The subject is one of the listed values. |
| `closeTo` | `expect total closeTo 99.0 { within: 0.01 }` | The two numbers differ by no more than the tolerance. `within` defaults to `0.01`. |

`not` negates any of them: `expect not plan oneOf ["a", "b"]`.

### How `equals` compares

Maps and lists compare by value, not by reference: a body built twice the same way is the same
thing, and comparing it by identity would fail an assertion that reads as true on the page.

- A field set to nothing is not a field. `{ id: 1, ref: absent }` equals `{ id: 1 }`, because both
  print and travel over the wire identically. A field holding `null` is still a field, so
  `{ id: 1, ref: null }` does not.
- A value that contains itself is handled rather than overflowing the stack: two containers already
  open on the way down are taken as equal, the way one cycle matches another.
- Anything that is neither a map nor a list (dates, plugin objects, closures) compares by identity.

`contains` compares list items the same way, so `expect rows contains { id: 1 }` works.

## What a failure looks like

The title is one line, in the values' own terms:

```
expected { status: "pending" } to equal { status: "paid" }
expected 500 to be one of [200, 204]
expected 99.5 to be within 0.01 of 99
```

The values are written by `ctx.show`, the one definition behind `print`, `str` and `"${…}"`, so a
red check and a `print` of the same value agree about what it looks like. What this plugin decides
is width, not shape: a title is one line, so a side past that budget is cut where it stands and
marked with `…` rather than rewritten into prose. A string is quoted, the one place a value on the
line reads differently from a value on its own, because `expect "200" equals 200` failing with
`expected 200 to equal 200` is a line nobody can act on.

The full values are not lost: each matcher hands back the two sides, and the kernel turns them into
the diff carried by the `VN6001` problem. Membership matchers (`contains`, `oneOf`) mark their sides
unaligned, because the needle was held against every item and never stood opposite item 0. A
negated `expect` gets no diff on purpose: under `not` the two sides matched, and "expected 200,
actual 200" explains nothing.

## API

| Export | What it is |
| --- | --- |
| `assertPlugin` (also the default export) | The `PluginDefinition`: namespace `assert`, matchers only, no actions, no `typeDefs`, no required capability. |
| `assertMatchers` | The four `MatcherDefinition`s, in order: `equals`, `contains`, `oneOf`, `closeTo`. |

A matcher is a plain object, so it can be exercised directly. `message` and `detail` take the
`MatcherContext` the runtime normally hands over, whose `show` is how a value becomes text:

```ts
import { assertMatchers } from "@venn-lang/assert";

const ctx = { log: () => {}, show: (value: unknown) => JSON.stringify(value) ?? "null" };
const equals = assertMatchers.find((matcher) => matcher.name === "equals");

equals?.test({ subject: { id: 1 }, args: [{ id: 1 }], params: {} });
// true
equals?.message({ subject: "200", args: [200], params: {} }, ctx);
// 'expected "200" to equal 200'
equals?.detail?.({ subject: { status: "pending" }, args: [{ status: "paid" }], params: {} }, ctx);
// { expected: { status: "paid" }, actual: { status: "pending" } }
```

In a run the `show` is the language's own, so the same call gives
`expected { status: "pending" } to equal { status: "paid" }`.

## See also

- [`@venn-lang/sdk`](../sdk) for `defineMatcher` and the definition types used here.
- [`@venn-lang/runtime`](../runtime) for the registry that resolves a bareword and emits `VN6001`.
- [`@venn-lang/fmt`](../std-fmt) for turning a value into text you can assert against.
