# Basics

The whole language before any plugin is involved: values, text, functions, control flow,
collections and units. Start here if you have never seen Venn. Read the files in order, because
each one assumes the one before it.

| file | what it shows |
| --- | --- |
| [`01-hello.vn`](01-hello.vn) | `print`, comments, doc comments, and what makes a file a program |
| [`02-values.vn`](02-values.vn) | numbers, strings, booleans, `null`, `const` and `let`, operators |
| [`03-strings.vn`](03-strings.vn) | `"${}"` interpolation and the members every string carries |
| [`04-functions.vn`](04-functions.vn) | `fn`, the arrow form, functions as values, recursion |
| [`05-control-flow.vn`](05-control-flow.vn) | `if`, the ternary, `forEach`, `repeat`, `while`, `break`, `continue` |
| [`06-lists.vn`](06-lists.vn) | `map`, `filter`, `reduce`, `sort`, `sortBy`, `groupBy` and friends |
| [`07-maps.vn`](07-maps.vn) | map literals, `keys`, `get`, `merge`, `mapValues`, `entries`, and taking one apart with `{ … }` |
| [`08-units.vn`](08-units.vn) | `300ms`, `2mb`, `99.9%`, and how arithmetic keeps the unit |
| [`09-terminal.vn`](09-terminal.vn) | reading a line and a key, asking what the terminal is, moving the cursor, and the same program through a pipe |
| [`10-json.vn`](10-json.vn) | reading text into a value with a shape, the text nobody promised was JSON, and writing it back out |

Run them with:

```bash
venn run examples/basics/01-hello.vn
```

Or check the lot without running anything:

```bash
venn check examples/basics/
```

Two things surprise most newcomers, and both are on purpose.

**There is no assignment.** A name binds once and holds that value for as long as it is in scope.
Loops rebind their item name on each pass, and a block that binds a name that already exists gets
a second, separate name. That is why `05-control-flow.vn` reaches for `filter` where another
language would build up a variable, and why a `while` loop needs `break` unless it is waiting on
something outside the program.

**Units are part of the type.** `300ms + 1s` is a duration; `300ms + 2mb` is a compile error, not a
strange number discovered at runtime.

Nothing here imports a plugin, so nothing here touches the network or the disk. When you want a
verb such as `http.get`, or a `flow` that `venn test` can run, carry on to `examples/language/`.
