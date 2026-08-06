---
"@venn-lang/core": patch
---

A `type` names a type, not an abbreviation for one.

```venn
type Meters = number
type Feet = number
fn addUp(a: Meters, b: Meters) -> number => a + b

const h: Feet = 30
const w: Meters = 10
print addUp(h, w)
```

That printed `40`. Thirty feet plus ten metres, no diagnostic, exit 0. The
annotation said `Meters` twice and enforced nothing, which is worse than no
annotation, because a reader believes it.

It now reports `VN3010 · Type mismatch: expected Meters, found Feet.`

## The rule

**A shape nobody named flows into a name. A name flows into the shape under it.
One name in another name's place is refused.**

That is the whole of it, and only the third line is new:

| from | into | |
| --- | --- | --- |
| `{ seller: "ana" }` | `Sale` | passes, so data still arrives as data |
| `Sale` | `{ seller: string }`, `number`, `string` | passes, so arithmetic and the standard library still work |
| `Feet` | `Meters` | **refused** |

A named union is a name over other names, so `Ping` still fits
`type Message = Ping | Text`, while `Plan` and `Tier` stay two types though both
are `"free" | "pro"`.

## Why it costs so little

The name is carried beside the shape rather than wrapping it, so the hundred and
six places that ask `kind === "record"` get the same answer they always did and
never learn that names exist. Two readers ask: `fits`, and `showType`.

One thing had to change to make it hold. `union` flattened its members, which
spilled a named union back into its parts and lost the name, so a union was the
one declaration whose name could not survive being written down.

## What it changes for a reader

Every message that printed a shape now prints the name the reader wrote:
`expected User, found { name: number }` rather than
`expected { name: string }, found { name: number }`, and
`Type P has no field "nope"` rather than `Type { name: string } has no field`.
The hover follows, without the editor being touched.

Two types can now print the same, which a shape never could: a file may declare
a `Fn` beside the built-in handle. `expected Fn, found Fn` is the worst line a
checker can produce, so when both sides print alike the message names that and
shows the shapes instead.

## What it does not do

There is no new keyword, and nothing that ran before stops running. The only new
error is between two names, and until now those were indistinguishable, so no
program could have been relying on mixing them.
