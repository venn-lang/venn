# @venn-lang/path

> The `path` namespace: joining a path, taking one apart, and asking where it leads.

Every path in a Venn file used to be built by adding strings together, which is how a program ends
up with `a//b` on one machine and a backslash on another. Here the separator is never an argument
and never an answer: it belongs to the host.

## Install

Part of the stdlib the `venn` CLI and the language server load:

```ruby
import { path } from "venn/path"
```

## Usage

```ruby
import { path } from "venn/path"

const name = "cart.json"
const fixture = path.join(path.cwd(), "fixtures", name)

print path.basename(fixture)          # cart.json
print path.stem(fixture)              # cart
print path.extension(fixture)         # .json
print path.withExtension(fixture, "csv")

# A name that came from outside is checked before it is used, not after.
const requested = "../etc/passwd"
if !path.isInside("uploads", requested) {
  fail "that name leaves the upload directory"
}
```

## Verbs

### Making one

| Verb | Signature | What it does |
| --- | --- | --- |
| `path.join` | `(…string) -> string` | The parts as one path, one separator between each. |
| `path.resolve` | `(…string) -> string` | The same, made absolute from the current directory. |
| `path.normalize` | `(string) -> string` | `.` and `..` worked out, separators tidied. |
| `path.relative` | `(string, string) -> string` | How to get from one to the other. |
| `path.cwd` | `() -> string` | Where the program is running from. |

### Taking one apart

| Verb | Signature | What it does |
| --- | --- | --- |
| `path.dirname` | `(string) -> string` | Everything but the last part. |
| `path.basename` | `(string) -> string` | The last part, extension and all. |
| `path.stem` | `(string) -> string` | The last part without its extension. |
| `path.extension` | `(string) -> string` | The last dot and what follows it. |
| `path.withExtension` | `(string, string) -> string` | The same path ending in another one. |
| `path.split` | `(string) -> list of string` | The parts, separators gone. |

### Asking about one

| Verb | Signature | What it does |
| --- | --- | --- |
| `path.isAbsolute` | `(string) -> bool` | Whether it starts somewhere fixed. |
| `path.isInside` | `(string, string) -> bool` | Whether it stayed in the directory it was given. |

## The separator is the host's

`path.join("a", "b")` is `a/b` under the editor's worker and `a\b` on the machine that runs it. The
program never says which, because the program is not the one that knows.

That is a port, `venn.port.paths`, with an implementation per spelling and a conformance suite both
run. What they are allowed to disagree about is the separator and what makes a path absolute.
Everything else, what `..` means, where a name ends, the walk between two places, is asked of both.

## A path that leaves is answerable before it is used

```ruby
import { path } from "venn/path"

print path.isInside("uploads", "uploads/report.pdf")     # true
print path.isInside("uploads", "uploads/../etc/passwd")  # false
print path.isInside("uploads", "/etc/passwd")            # false
```

`..` is worked out first, so a name that climbs out is caught wherever the climb was written, and a
directory whose name merely starts the same (`data-evil` next to `data`) is a different directory.

## Nothing here touches a disk

Every answer comes from reading the path. A file that does not exist yet still has a name and a
parent, and asking about them is how a program works out whether to make it. What is on the disk is
a separate question, and this namespace never asks it.

## API

| Export | What it is |
| --- | --- |
| `pathPlugin` (also the default export) | The `PluginDefinition`: namespace `path`. |
| `buildActions`, `partActions`, `questionActions` | The `ActionDefinition`s, in three groups. |
| `paths` | The host's spelling, out of an `ActionContext`. |

## See also

- [`@venn-lang/contracts`](../contracts) for the `Paths` port and its two spellings.
