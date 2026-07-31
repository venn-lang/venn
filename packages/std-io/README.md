# @venn-lang/io

> The `io` namespace: the standard streams, the terminal behind them, and the process arguments.

A Venn file is a program as often as it is a suite, and a program talks to the outside world through
its console. This plugin names the parts of it that need naming, on top of the `Console` port. Plain
`print` is in the prelude and needs no import; everything else is here.

## Install

`@venn-lang/io` is part of the stdlib the `venn` CLI and the language server load, so there is nothing to
install. A file that uses it says so:

```ruby
import { io } from "venn/io"
```

The plugin declares `requires: ["io"]`. A host that offers no console (the Web Worker host behind
the editor offers `fs`, `clock`, `random`, `secrets` and `log`) refuses it at load time with
`VN2010`, rather than failing with a `TypeError` halfway through a run.

## Usage

```ruby
# greet.vn, run with `venn run greet.vn Ada`
import { io } from "venn/io"

const argv = io.args
io.print "arguments: ${argv}"

io.write "name? "
const name = io.readLine
if name == null {
  io.eprint "no name on standard input"
  exit 1
}

io.print "hello, ${name}"
```

## Verbs

**Writing**

| Verb | Signature | What it does |
| --- | --- | --- |
| `io.print` | `(...dynamic) -> void` | Writes to standard output with a newline. The same as the prelude's `print`. |
| `io.write` | `(dynamic) -> void` | Writes to standard output with nothing added after it. |
| `io.eprint` | `(dynamic) -> void` | Writes to standard error, followed by a newline. |

**Reading**

| Verb | Signature | What it does |
| --- | --- | --- |
| `io.readLine` | `() -> string \| null` | The next line of standard input, or `null` at end of input. |
| `io.readAll` | `() -> string` | Everything left on standard input, which is how a pipe hands over. |
| `io.readKey` | `() -> Key \| null` | The next keypress, as it is pressed rather than when a line ends. |
| `io.ask` | `(string) -> string \| null` | Writes a question and reads the answer, which is the two of them at once. |

**The terminal**

| Verb | Signature | What it does |
| --- | --- | --- |
| `io.size` | `() -> { columns, rows } \| null` | How big it is, or `null` when the output is not a terminal. |
| `io.isTerminal` | `(string) -> bool` | Whether `"in"`, `"out"` or `"err"` is one. Decides colour, redrawing and whether to ask. |
| `io.cursor.to` | `(number, number) -> void` | Put the cursor at a column and row, both counting from 1. |
| `io.cursor.move` | `(number, number) -> void` | Move it from where it is. Negative goes left and up. |
| `io.cursor.hide` / `io.cursor.show` | `() -> void` | Hide the caret while redrawing, and put it back. |
| `io.clearLine` | `() -> void` | Clear the line the cursor is on, and put the cursor at its start. |
| `io.clear` | `() -> void` | Clear the screen and go to the top left. |
| `io.args` | `() -> list<string>` | The command-line arguments passed to the script. |

A keypress arrives as `{ name, text, ctrl, alt, shift }`. `name` is the key spelled out, so
`up`, `enter` and `escape` are readable without a table of escape codes, and `text` is what the key
would have typed, empty for the ones that type nothing.

Every screen operation is **quietly ignored where there is no terminal**, and `size` answers `null`
there, so one program run interactively and through a pipe is the same program.

`io.print` takes as many values as you like and joins them with a space. Strings are written as
they are; anything else is rendered as JSON, so a map never prints as `[object Object]`.

`readLine` returns a union with `null` in its signature, not a bare `string`: end of input is a real
answer and a caller has to face it. `args` returns a `list<string>` rather than a bare list, so
`argv.len` and the rest of the list methods type correctly.

Arguments reach `io.args` from the command line: `venn run greet.vn Ada` gives `["Ada"]`.

## The Console port

The verbs above are a thin layer over one port, which lives in
[`@venn-lang/contracts`](../contracts) because a console is a host capability like the filesystem or the
clock, not something this plugin owns.

| | |
| --- | --- |
| Id | `venn.port.console` |
| Version | `1` |
| Requires | `io` |
| Methods | `write`, `writeError`, `readLine`, `readAll`, `readKey`, `args`, `size`, `isTerminal`, `screen`, `onResize` |

Two implementations ship with it, and both pass the same conformance suite: `createNodeConsole` from
`@venn-lang/contracts/node`, which writes to Node's real streams and opens stdin on the first
read, and `createMemoryConsole`, which records instead of printing and reads from a scripted input.
The fake records **screen operations rather than escape codes**, so a test says "the cursor went to
3, 5" instead of matching bytes, and `resize` arranges the one thing a test otherwise cannot. `venn run` binds the real one, with the command line's arguments; a test binds the recorder
and reads back exactly what the program wrote:

```ts
import { createMemoryConsole } from "@venn-lang/io";

const console = createMemoryConsole({ input: ["Ada"], argv: ["--name", "ada"] });

console.write(">");
console.out; // ">"
await console.readLine(); // "Ada"
await console.readLine(); // null
console.args(); // ["--name", "ada"]
```

A fake terminal is a fake console that says it is one:

```ts
const console = createMemoryConsole({ size: { columns: 80, rows: 24 }, terminal: ["out"] });

console.size(); // { columns: 80, rows: 24 }
console.screen({ kind: "clearLine" });
console.ops; // [{ kind: "clearLine" }]
console.resize({ columns: 100, rows: 30 }); // every listener hears it
```

## API

| Export | What it is |
| --- | --- |
| `ioPlugin` (also the default export) | The `PluginDefinition`: namespace `io`, requires the `io` capability. |
| `consoleActions` | Writing: `print`, `write`, `eprint`. |
| `inputActions` | Reading: `readLine`, `readAll`, `readKey`, `ask`. |
| `screenActions` | The terminal: its size, whether it is one, the cursor and clearing. |
| `ConsolePort` | The port descriptor, re-exported from `@venn-lang/contracts`. |
| `Console` | The port's interface (type only). |
| `createMemoryConsole` | The recording implementation, for tests. |

## See also

- [`@venn-lang/contracts`](../contracts) for the port, its Node implementation and the host capabilities.
- [`@venn-lang/fmt`](../std-fmt) for turning a value into the text you print.
- [`@venn-lang/cli`](../cli) for `venn run`, which binds the real console and passes the arguments in.
