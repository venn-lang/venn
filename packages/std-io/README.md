# @venn-lang/io

> The `io` namespace: standard output, standard error, standard input and the process arguments.

A Venn file is a program as often as it is a suite, and a program talks to the outside world through
its console. This plugin names the parts of it that need naming, on top of the `Console` port. Plain
`print` is in the prelude and needs no import; everything else is here.

## Install

`@venn-lang/io` is part of the stdlib the `venn` CLI and the language server load, so there is nothing to
install. A file that uses it says so:

```ruby
use "venn/io"
```

The plugin declares `requires: ["io"]`. A host that offers no console (the Web Worker host behind
the editor offers `fs`, `clock`, `random`, `secrets` and `log`) refuses it at load time with
`VN2010`, rather than failing with a `TypeError` halfway through a run.

## Usage

```ruby
# greet.vn, run with `venn run greet.vn Ada`
use "venn/io"

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

| Verb | Signature | What it does |
| --- | --- | --- |
| `io.print` | `(...dynamic) -> void` | Writes to standard output with a newline. The same as the prelude's `print`. |
| `io.write` | `(dynamic) -> void` | Writes to standard output with nothing added after it. |
| `io.eprint` | `(dynamic) -> void` | Writes to standard error, followed by a newline. |
| `io.readLine` | `() -> string \| null` | The next line of standard input, or `null` at end of input. |
| `io.args` | `() -> list<string>` | The command-line arguments passed to the script. |

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
| Methods | `write`, `writeError`, `readLine`, `args` |

Two implementations ship with it, and both pass the same conformance suite: `createNodeConsole` from
`@venn-lang/contracts/node`, which writes to Node's real streams and opens stdin lazily on the first
`readLine`, and `createMemoryConsole`, which records instead of printing and reads from a scripted
input. `venn run` binds the real one, with the command line's arguments; a test binds the recorder
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

## API

| Export | What it is |
| --- | --- |
| `ioPlugin` (also the default export) | The `PluginDefinition`: namespace `io`, requires the `io` capability, five actions, no types. |
| `consoleActions` | The five `ActionDefinition`s, in the order listed above. |
| `ConsolePort` | The port descriptor, re-exported from `@venn-lang/contracts`. |
| `Console` | The port's interface (type only). |
| `createMemoryConsole` | The recording implementation, for tests. |

## See also

- [`@venn-lang/contracts`](../contracts) for the port, its Node implementation and the host capabilities.
- [`@venn-lang/fmt`](../std-fmt) for turning a value into the text you print.
- [`@venn-lang/cli`](../cli) for `venn run`, which binds the real console and passes the arguments in.
