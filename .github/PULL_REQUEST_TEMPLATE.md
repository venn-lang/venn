<!--
Thank you for the pull request. A short description beats a long one, and a
failing test that now passes beats both.
-->

## What this changes

<!-- One or two sentences. What behaves differently after this? -->

Closes #

## Why

<!-- The problem, not the patch. Skip if the linked issue already says it. -->

## How it was verified

<!-- What you ran, and what it said. "Tests pass" on its own is not enough:
     say which behaviour is now covered that was not before. -->

- [ ] `pnpm -r --sort run build`
- [ ] `pnpm -r run typecheck`
- [ ] `pnpm test`
- [ ] `pnpm lint`

## Checklist

- [ ] A test covers the change, and it fails without it
- [ ] Public API has JSDoc: what it does, takes, returns and throws
- [ ] A changeset is included (`pnpm changeset`), or this needs no release
- [ ] Documentation is updated if behaviour changed
- [ ] No em dash in code, comments, documentation or commit messages

<!--
If this changes the language itself (syntax, semantics, the type system), it
should be a language proposal first, discussed before it is built.
-->
