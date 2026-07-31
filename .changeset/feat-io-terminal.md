---
"@venn-lang/contracts": minor
"@venn-lang/io": minor
---

Let a program read from the terminal, and see the one it is writing to.

```venn
import { io } from "venn/io"

const name = io.ask("your name: ")
const screen = io.size()
if screen != null {
  io.cursor.hide()
  io.clearLine()
}
```

Reading was a line at a time, and on a real terminal it was nothing at all: the
node console ended standard input the moment it saw a TTY, so a program could
never wait for anyone to type. It waits now, and reads a line, one keypress as it
is pressed, or everything a pipe hands over.

The terminal itself can be asked about: how big it is, whether each stream is one,
and when it is resized. The cursor can be moved, hidden and shown, and a line or
the screen cleared. Every screen operation is quietly ignored where there is no
terminal, so one program run interactively and through a pipe is one program.

The `Console` port grew to match, with both implementations and the conformance
suite. Cursor and screen work is named rather than written as escape codes: the
real console emits ANSI, the fake records what was asked, and a test asserts the
operation.
