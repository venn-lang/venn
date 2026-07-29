# @venn-lang/toolchain

> Which version of the language a directory is asking for, and where the versions on a machine live.

The `venn` binary does not contain the language. It works out which version a
directory wants, installs it if it is not there, and hands the command over.
This package holds the part that decides.

Nothing here reads a `.vn` file or knows what one is. That separation is the
point: the binary you install stays small, and the language is a thing it
fetches and keeps, one directory per version.

## Two questions, kept apart

What a directory asked for is one question. Which installed version that turns
out to mean is another, and it needs to know what is installed.

```ts
import { createNodeFs } from "@venn-lang/contracts/node";
import { describe, resolveVersion, selectVersion } from "@venn-lang/toolchain";

const request = await resolveVersion({
  fs: createNodeFs(),
  directory: process.cwd(),
  defaultVersion: "0.1.3",
});

const choice = selectVersion({ request, installed: ["0.1.3", "0.2.0", "0.2.4"] });

console.log(describe(choice));
// 0.2.4, the newest matching 0.2.x, pinned by /work/api/venn.toml
```

Neither touches the network, writes anything, or runs anything. What to do about
a version nobody installed belongs to whoever asked.

## What decides

In order, first answer wins:

| | |
| --- | --- |
| `venn` in `[package]` of a `venn.toml` | a project pinning its language where the rest of its decisions live |
| a `.venn-version` file | a directory that is not a project, or a pin you would rather not put in a manifest under review |
| the default given | the version chosen for everything that does not ask |
| nothing | `*`, which the newest installed version answers |

The search walks up from the directory given, nearest first, so a command run
inside `tests/api` gets the version its project declared. The nearest pin wins,
which lets one member of a workspace hold itself back while the rest move on.

A manifest that pins nothing, or cannot be parsed at all, is passed over rather
than raising: a broken manifest is the compiler's to complain about, with a
location and a line, which is more than this could say.

## A pin can be a range

```toml
[package]
venn = "0.2.x"        # any 0.2, newest installed
venn = "^1.2.0"       # any 1.x from 1.2 up
venn = ">=1 <1.5"     # a window
venn = "0.2.0"        # that one
```

Always the newest that matches, never an arbitrary one. Pinning `0.2` and
getting `0.2.1` today and `0.2.4` tomorrow would make a pin worse than no pin.

A prerelease only answers a range that asks for it by name. Running on a release
candidate is a decision, and `1.x` quietly picking up a `1.5.0-rc.1` that
happened to be installed is not how anyone would want to make it.

## Asking the registry what exists

The same range language, against what is published rather than what is
installed. A tag is looked up rather than parsed, so `latest` means what the
registry says it means.

```ts
import { catalogueOf, createFetchJson, releaseFor } from "@venn-lang/toolchain";

const catalogue = await catalogueOf({ fetchJson: createFetchJson() });

releaseFor({ catalogue, request: "latest" });
// { version: "0.1.3", tarball: "https://…/cli-0.1.3.tgz", integrity: "sha512-…" }

releaseFor({ catalogue, request: "0.1.x" });   // the newest published 0.1
releaseFor({ catalogue, request: "9.x" });     // undefined
```

`fetchJson` is passed in rather than reached for, so this is testable without a
network and a mirror or a proxy is a different function rather than a rewrite.

It asks for the abbreviated document, which holds the tags, the versions and
each tarball with its hash. For this package that is 4 KB where the full one is
21, and the full one grows with every release while the abbreviated one keeps
its shape.

A version published without a tarball or without an integrity hash is left out.
It could not be installed and could not be checked, so offering it would only
fail later and further away.

## Installing one

```ts
const release = releaseFor({ catalogue, request: "latest" });

await installVersion({
  fs: createNodeFs(),
  release,
  into: `${homedir()}/.venn/versions`,
  fetchBytes: createFetchBytes(),
});
// ~/.venn/versions/0.1.3
```

The download is checked against the hash the registry published before anything
is unpacked. A mirror, a proxy or anything else in between can hand over
different bytes, and only the hash says so.

Files are unpacked beside the destination and moved in at the end, so an
interrupted install leaves nothing that looks finished. A half-written version
directory is worse than none: the next command finds it, believes it, and fails
somewhere further away.

### What an archive is not allowed to do

A name inside a tarball is a claim about where its content should end up, made
by whoever built it. `../../.ssh/authorized_keys` is a perfectly valid tar
entry, and a reader that joins names onto a path without asking will write it
exactly where it says.

So an entry is only written when its name stays inside: no segment that climbs,
nothing anchored to a root or a drive, no backslash used to smuggle one past,
and nothing outside the `package/` prefix. Anything else is skipped and the rest
of the archive still installs.

Only regular files are taken. Directories arrive implicitly with the files in
them, and a symlink, a hard link or a device node has no business coming out of
a package tarball.

## The reason travels with the answer

`describe` exists because someone asking which version they are on has usually
just been surprised by it. `0.2.0` starts that conversation. `0.2.0, pinned by
/work/api/venn.toml` ends it.
