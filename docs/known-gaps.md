# Known gaps

Places where the language, the specification and the implementation disagree.
Each was found by writing real code against Venn, not by reading it, and each is
reproducible with the snippet given.

Nothing here is a crash. They are things a user will reasonably try, and be
surprised by.

---

## 1. `while` cannot count

**Severity: high.** The specification's own example would not terminate.

There is no assignment, so a loop cannot advance a counter. The condition is
evaluated in the enclosing scope while the body runs in a child scope, so a
`const` rebound inside the body is invisible to the condition.

```ruby
const n = 0
while n < 3 {
  const n = n + 1     # binds a new `n` in the body's scope
}                     # the condition still reads the outer `n`, forever
```

`docs/venn-language.md:400` shows a counting `while`. It cannot work as written,
and `packages/runtime/src/scheduler/while-limit.test.ts` asserts that this exact
shape is stopped by the loop limit (VN8002).

Today `while` is only useful with `break`, or waiting on something a verb
changes. Either the spec should say that, or the language needs a way to carry
state across iterations.

## 2. The specification promises syntax the grammar does not have

**Closed.** Two of the three forms are in the grammar:

```venn
r"C:aw
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

**Severity: medium.** Only `fn`, `fragment` and `deco` can be exported. A `type`
or a `const` cannot cross a file boundary, so every file redeclares the shapes it
needs and there is no way to share a constant.

`packages/runtime/src/check/check-imports.ts` treats only those three as
published, and importing anything else reports VN2009.

This is the gap most likely to hurt a real project.

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
