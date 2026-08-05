# @venn-lang/fs

> The `fs` namespace: reading a file whole, writing one whole, and asking what is on the disk.

Until this package there were twenty-three namespaces and not one verb that read or wrote a file. A
program that wanted to summarise a JSON file could not open it: it read standard input, printed to
standard output, and left the shell to say which file it meant. That is a filter wearing the costume
of a program, and it stops being possible the moment the program is run by anything but a shell.

Four verbs, all of them over the file system port the language already had. Nothing here opens a
handle, seeks, or keeps a file open across a statement.

## Install

Part of the stdlib the `venn` CLI and the language server load:

```ruby
import { fs } from "venn/fs"
```

The plugin declares `requires: ["fs"]`. A host with no disk refuses it once, at load time, with
`VN2010`, rather than letting a program get halfway and fail on its first read.

## Usage

```ruby
import { fs } from "venn/fs"
import { json } from "venn/json"
import { fmt } from "venn/fmt"

const doc = try json.parse(fs.read("inventory.json")) else null
if doc == null {
  fail "inventory.json is not JSON"
}

const summary = {
  total: doc.items.sumBy(i => i.qty * i.price),
  outOfStock: doc.items.filter(i => i.qty == 0).map(i => i.name)
}

fs.write("summary.json", fmt.json(summary))
print "wrote summary.json"
```

## Verbs

| Verb | Signature | What it does |
| --- | --- | --- |
| `fs.read` | `(string) -> string` | The whole file as text, read as UTF-8. |
| `fs.write` | `(string, string) -> void` | The text as the whole file. Missing parents are made. |
| `fs.exists` | `(string) -> bool` | Whether there is anything at that path. |
| `fs.list` | `(string) -> list of { name, directory }` | What a directory holds, one level deep. |

## A file that is not there is a failure, not a value

`fs.read` refuses a file that is not there. It does not answer `null`, because `null` in this
language means there is no value at this position, and a file that is not on the disk is a fact
about the world rather than an empty position. So it is caught the way every other failure is:

```ruby
import { fs } from "venn/fs"

try {
  print fs.read("nowhere.json")
} catch e {
  print "${e.code}: ${e.message}"
}
```

That prints `VN8010: File not found: "nowhere.json".` The code is the one the file system port has
always raised, and this namespace neither renames it nor writes a second sentence about it.

When a default will do, the expression form is shorter and needs no binding:

```ruby
import { fs } from "venn/fs"

const settings = try fs.read("settings.json") else "{}"
print settings
```

And when the question is genuinely a question rather than a failure, ask it:

```ruby
import { fs } from "venn/fs"

if fs.exists("settings.json") {
  print fs.read("settings.json")
}
```

## Walking a directory

`fs.list` gives one level, each entry naming itself and saying whether it holds more. A deeper walk
is that plus a loop, which is a walk the program can see rather than one hidden inside a verb:

```ruby
import { fs } from "venn/fs"
import { path } from "venn/path"

forEach entry in fs.list("examples") {
  if entry.directory {
    print "dir  ${entry.name}"
  } else {
    print "file ${path.join('examples', entry.name)}"
  }
}
```

An entry is a name, never a path. Joining it to the directory it came from belongs to `venn/path`,
which knows the separator this host writes and never says it out loud.

## Nothing here is a second file system

Every byte goes through `venn.port.filesystem`, the port that already had two implementations and a
conformance suite both are run against: the real disk for the CLI, an in-memory double for tests and
for the editor's worker. This package imports no `node:*` and builds `platform: "neutral"`, which is
why the same verbs are available to the language server that is available to the command line.

That is also why the verbs are the shape they are. The port speaks bytes and knows nothing about
text, so the UTF-8 in `fs.read` and `fs.write` is this package's, done once, through the encoder the
SDK already publishes.

## What is deliberately absent

| Not here | Why |
| --- | --- |
| `fs.remove`, `fs.removeAll` | Nothing in the programs that asked for a file system deleted one. A delete verb needs a decision about whether it recurses and whether it may leave the directory it was given, and that is a conversation, not a fifth verb. |
| `fs.append` | A second way to write. Read, add, write back covers it until a program shows a log that cannot. |
| `fs.readBytes`, `fs.writeBytes` | The language has no bytes value, so a binary verb would answer with something a program cannot hold. |
| `fs.walk` | `fs.list` and a loop are the same walk, and a recursive verb has to decide about links that point at their own parent. |
| `fs.mkdir` | `fs.write` makes the parents it needs. An empty directory is the only case left and nothing asked for one. |
| Size, modified time, permissions | The port has no `stat`, and widening a conformance contract two implementations are held to is not something to do for a question nobody has asked. |

## API

| Export | What it is |
| --- | --- |
| `fsPlugin` (also the default export) | The `PluginDefinition`: namespace `fs`, requires `fs`. |
| `contentActions`, `questionActions` | The `ActionDefinition`s, in two groups. |
| `files` | The host's disk, out of an `ActionContext`. |
| `ENTRY_TYPE` | What one `fs.list` entry is, as the checker sees it. |

## See also

- [`@venn-lang/contracts`](../contracts) for the `FileSystem` port, its two implementations and the
  suite both are run against.
- [`@venn-lang/path`](../std-path) for building the names this namespace reads.
