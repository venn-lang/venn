# @venn-lang/toolchain

> Which version of the language a directory is asking for, and where the versions on a machine live.

The `venn` binary does not contain the language. It works out which version a
directory wants, installs it if it is not there, and hands the command over.
This package holds the part that decides.

Nothing here reads a `.vn` file or knows what one is. That separation is the
point: the binary you install stays small, and the language is a thing it
fetches and keeps, one directory per version.

## resolveVersion

```ts
import { createNodeFs } from "@venn-lang/contracts/node";
import { describe, resolveVersion } from "@venn-lang/toolchain";

const resolved = await resolveVersion({
  fs: createNodeFs(),
  directory: process.cwd(),
  defaultVersion: "0.1.3",
});

console.log(describe(resolved));
// 0.2.0, pinned by /work/api/venn.toml
```

It answers a question and does nothing else: no network, no writes, nothing
spawned. What to do about a version that is not installed belongs to whoever
asked.

## What decides

In order, first answer wins:

| | |
| --- | --- |
| `venn` in `[package]` of a `venn.toml` | a project pinning its language where the rest of its decisions live |
| a `.venn-version` file | a directory that is not a project, or a pin you would rather not put in a manifest under review |
| the default given | the version chosen for everything that does not ask |
| nothing | said plainly, rather than guessed at |

The search walks up from the directory given, nearest first, so a command run
inside `tests/api` gets the version its project declared. The nearest pin wins,
which lets one member of a workspace hold itself back while the rest move on.

A manifest that pins nothing, or cannot be parsed at all, is passed over rather
than raising: a broken manifest is the compiler's to complain about, with a
location and a line, which is more than this could say.

## The reason travels with the answer

`describe` exists because someone asking which version they are on has usually
just been surprised by it. `0.2.0` starts that conversation. `0.2.0, pinned by
/work/api/venn.toml` ends it.
