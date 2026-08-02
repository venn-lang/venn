---
"@venn-lang/runtime": minor
---

The argument a verb swallows is caught wherever it happens, not only in three names.

```venn
import { io } from "venn/io"

io.print { a: 1 }
```

`print { a: 1 }` has said `VN5002` since the lint family existed: a trailing
`{ … }` on a verb is always its options, so this hands over nothing and prints
an empty line. The rule was checked for `print`, `log` and `skip` by name,
because those three are the language's own and take no options at all. A
plugin's verb in the same shape said nothing: `io.print` is the same verb
under its full name, but it was not on the list, so the map above vanished
just as quietly.

The rule was never really about those three names. It is about a verb that
declares no options schema at all, prelude or plugin's alike: nothing there is
free-form the way `grpc.request`'s catchall map is, so a bare `{ … }` is read
as options it does not have. `fail` is the one prelude verb this leaves alone,
since `{ code, data }` is genuinely read there, informally rather than
through a schema.

The three names now report `VN5007` instead of `VN5002`, alongside every
plugin verb the same rule now reaches. One rule said one way, rather than the
same rule in two codes depending on where the verb came from.

A verb legitimately joined to the next by `;` on one line, such as `mock.reset;
mock.start "payments"`, is unaffected: the semicolon is read as the deliberate
separator it is, not as the sign of a verb handed something it could not take.
