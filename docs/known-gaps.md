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

**Severity: medium.** Three forms are documented in §03 and simply do not parse:

- raw strings, `r"C:\path"`
- triple-quoted blocks, `"""…"""`
- regular expression literals, `/pattern/i`

The `STRING` terminal in `packages/core/src/grammar/venn.langium` has none of
them. Either implement them or cut them from the specification, because a reader
following the spec today writes code that does not compile.

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

**Severity: low, but it surprises everyone.**

```ruby
print 300ms + 1s      # syntax error
print (300ms + 1s)    # fine
print a ?? b          # syntax error
```

An unparenthesised argument to an action call parses as an `ActionArg`, which
does not admit binary operators. The error message points at the operator rather
than explaining that the argument needs brackets.

## 6. A `Type` decorator runs but cannot type-check

**Severity: low.** `target.addField("id", "string")` works at run time, but
`venn check` runs before expansion, so a binding annotated with the widened type
fails VN3010. A decorator that changes a shape therefore cannot be used in a file
that also type-checks.

## 7. Step titles do not interpolate

**Closed.** A title is filled against the scope it belongs to, so each pass of a
`forEach` reports under its own, and `--step` matches what the reporter printed.
A placeholder naming something absent fills as empty rather than failing a step
over its own title.
