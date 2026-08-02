---
"@venn-lang/sdk": minor
"@venn-lang/date": minor
"@venn-lang/data": minor
"@venn-lang/math": minor
"@venn-lang/json": patch
"@venn-lang/http": patch
---

One rule for when a verb fails, and the verbs that disagreed with it fixed.

The stdlib answered the same question three ways, and one namespace did two of
them: `date.in` answered `null` for a timezone that is not one while
`date.format` refused the same name. Nothing decided this. Each verb was written
on its own day, so every one had to be looked up, and the one looked up last week
is the one that ends the run in production.

The rule is now written where a plugin author reads it, in the SDK's README:

- **The world failed**, so raise. A refused connection, a driver that is not
  there. Nothing the program wrote is wrong and nothing it can read would help.
- **The caller made a mistake**, so raise. A timezone that is not one, a range
  whose end is below its start. It is a bug in the program, and the run ending at
  the bug is the shortest way to the fix. That is `VN7005`.
- **The data was unreadable**, so answer with `null`. Text from a server, a field
  nobody set. Being unreadable is an ordinary thing for data to be.

A `tryX` twin belongs only where both readings are common enough to want a name
each, as with `json.parse` and `json.tryParse`, and never as the only spelling.

### What changed

| Verb | Was | Is |
| --- | --- | --- |
| `date.in` | `null` for a zone that is not one | refuses it, as `date.format` already did |
| `date.format` | refused, with no code | refuses with `VN7005`, and the same words |
| `data.range(10, 1)` | a number outside both ends | refuses with `VN7005` |
| `data.oneOf()` | nothing | refuses with `VN7005` |
| `math.randomInt(10, 1)` | a number outside both ends | refuses with `VN7005` |
| `data.json` | whatever the runtime threw | refuses with `VN7003`, in the language's words |
| `json.parse` | refused, with no code | refuses with `VN7003` |
| `http.on` | refused, with no code | refuses with `VN7005` |

`date.in` no longer answers `null`, so its type is the parts rather than the
parts or nothing.
