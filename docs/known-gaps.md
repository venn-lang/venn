# Known gaps

Places where the language, the specification and the implementation disagree.
Each was found by writing real code against Venn, not by reading it, and each is
reproducible with the snippet given.

Nothing here is a crash. They are things a user will reasonably try, and be
surprised by.

---

## 1. Nothing can carry state through a loop

**Closed by `loop`.** A value crosses an iteration boundary through `continue`,
so nothing is assigned and a name still means one value:

```venn
loop total = 0 {
  if total >= 6 { break }
  continue total + 2
}
print total          # 6
```

`while` is gone. It answered the same question `loop` answers, and in a language
with no assignment its condition could never be moved by its own body: every
`while` anybody wrote needed a `break` to avoid hanging, including the one in the
tutorial. The 100,000 iteration cap went with it, since a program that means to
run forever is allowed to, and what ends one that should have ended is the
timeout on the step or the flow.

Three words, three intents, no overlap: `repeat` when the count is known,
`forEach` when there is a collection, `loop` when it is neither.

## 2. The specification promises syntax the grammar does not have

**Closed.** Two of the three forms are in the grammar:

```venn
r"C:
aw
o\escape"      # every backslash survives
"""
  a block
  keeps its lines
"""
```

Both interpolate, since `${…}` is scanned out of the value either form leaves.

The regular expression literal was cut from the specification instead of built.
`/` is division, so telling a delimiter from an operator needs a lexer with
semantic lookahead, which is the same reason §02 already gives for paths no
longer being bare tokens. A pattern is a raw string, and the flags go inside it:

```venn
expect (order ~= r"Order #(\d+)")
expect (name ~= r"(?i:ana)")
```

What remains is the `regex` **type**, which §03 lists among the kernel's and
which does not exist: [#118](https://github.com/venn-lang/venn/issues/118).

## 3. Optional chaining fails the checker on a known shape

```ruby
type User { name: string, address: { city: string } }
const user: User = { name: "a", address: { city: "b" } }

print user.address?.postcode    # runs fine, prints nothing
```

**Closed.** `?.` asks whether something is there, so "no" is an answer rather
than an error. A plain `.` still says the member is there, and is still wrong
when it is not, and a field that does exist keeps its type either way.

## 4. `pub` covers only three declarations

**Closed.** `pub` covers `fn`, `fragment`, `deco`, `type` and a binding, so a
file can publish a shared vocabulary rather than every file redeclaring it.

```venn
pub type User { name: string }
pub const LIMIT = 10
```

An imported type is resolved by the checker, so a value of the wrong shape is
refused where it is written, one file away from the declaration. An imported
binding carries the type it has.

Two things fell out of it. A `pub` that is not at the top of a file published
nothing in silence, and is now refused. And a `pub const` is computed where it
stands, so modules are filled in the order they import each other: a chain of
three used to compute the middle one against nothing.

## 5. A bare argument cannot hold a binary operator

**Closed as intended, with a message that says so.**

```ruby
print 300ms + 1s
# An argument is one value, so `+` has to be bracketed. Write `print (300ms + 1s)`.
```

An argument is one value and its accesses: `x`, `x.y`, `x[0]`, `f(1)`. This is
the rule Haskell, Elm, OCaml and F# use, and for the same reason: arguments are
separated by spaces, so `print a b` is two of them, and no grammar can also read
`print a - b` as one.

The `-` looks like it should be ambiguous, since it negates as well as
subtracts, so `print a -1` could be two arguments with a negative second one.
It cannot be written: brackets after a value are a call, so `print a (-1)` calls
`a`. Passing a negative value as a second argument has no spelling at all, which
is [#116](https://github.com/venn-lang/venn/issues/116) rather than this.

## 6. A `Type` decorator runs but cannot type-check

**Closed.** The decorators that change a shape run before anything is checked
against one, so the check sees the type the program actually has. Only
declarations of types are expanded: a decorator that wraps a function changes
nothing the checker can see, and `venn check` should not execute a body to learn
nothing. A decorator contributed by a plugin is still invisible to the checker,
which cannot reach one.

## 7. Step titles do not interpolate

**Closed.** A title is filled against the scope it belongs to, so each pass of a
`forEach` reports under its own, and `--step` matches what the reporter printed.
A placeholder naming something absent fills as empty rather than failing a step
over its own title.
