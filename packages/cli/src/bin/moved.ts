#!/usr/bin/env node

/**
 * What `venn` is on this package now: a sentence saying where the command went.
 *
 * Until 0.1.3 this package was the command. It is a version of the language
 * now, which the orchestrator fetches into `~/.venn/versions` and hands each
 * project to, so the name `venn` belongs to `@venn-lang/venn`.
 *
 * Someone who upgrades a 0.1.x install runs `npm install -g @venn-lang/cli`,
 * one way or another, and lands here. Without this they would land on `venn:
 * command not found`, with a working compiler on disk and no way to reach it.
 */

const MESSAGE = `venn: the command moved to its own package.

  npm rm -g @venn-lang/cli
  npm i -g @venn-lang/venn

In that order. Both packages want to be called venn, and npm refuses to take a
name another package holds, so installing first fails with EEXIST.

The second one is the venn command. It keeps versions of the language in
~/.venn/versions and hands each project to the one it asks for, so two projects
on one machine can be on two versions. This package is one of those versions
now, and offers venn-run and venn-lsp for it to run.

Nothing you have written changes. venn test, venn run and the rest work as they
did, on the version each project asks for.
`;

process.stderr.write(MESSAGE);
process.exit(1);
