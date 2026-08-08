---
"@venn-lang/core": minor
---

A decorator reads what its target's parameters were declared as, not only what
they are called.

```venn
deco slash(target: Fn, describe: string) {
  const names = target.params
  const types = target.paramTypes
  target.wrap(fn (call, args) => "[${names} | ${types}] ${call(args)}")
}
@slash("Replies")
fn ping(at: string, loud: bool) => "pong at ${at}"
```

```
[["at", "loud"] | ["string", "bool"]] pong at noon
```

`params` answered the names and nothing answered the types, so a `@slash` that
turns a function into a command could name its options and not say what any of
them takes. A string parameter is a string option and a number is a number one,
and that is the whole of what was missing.

`paramTypes` is a `list<string>` beside `params`, one entry per name, in the
same order. A verb answering one parameter would read better in a loop, and a
decorator body has no loop: it has `let`, `const`, `if` and verbs on what it was
given. A decorator that knew the name to ask about would have to have that name
written into it, which is the one case that did not need the verb. The signature
travels whole, to `meta` and from there to whoever builds the options.

The text is the annotation as written. A union is its alternatives joined by
` | `, so `string | null` answers `"string | null"`. A literal keeps the quotes
the grammar gave it, so a program can tell the type named `GET` from the one
value `"GET"`. A generic stays whole, `list<string>`.

A parameter written without an annotation answers `""`, the same empty text
`name` answers for a declaration that has no name: nothing was written, and a
program tests that with `== ""` rather than being stopped mid-expansion. A name
a shape pattern binds answers `""` too, since the annotation on that parameter
describes the shape and not the names taken out of it.

A verb an `Fn` still does not have is still refused where it is written, with
the new one among the surface the refusal reports:

```
VN2017 · A Fn has no `wobble`. It has addParam, after, before, meta, name,
paramTypes, params, remove, removeParam, rename, wrap.
```
