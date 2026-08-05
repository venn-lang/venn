---
"@venn-lang/cli": patch
---

The release notes fit the page GitHub gives them.

`scripts/release-notes.mjs` folds each entry's prose into a `<details>` block, and
nothing bounded the total. GitHub refuses a release body over 125000 characters
with a 422, and the step that creates the release runs **after**
`changeset publish`, so a release too large to post fails with every package
already on npm and the version already tagged. That is the one failure in this
workflow that running it again does not fix.

Measured against the pending release: 67 changesets rendered **609558**
characters, 4.9 times the limit. The size follows the prose rather than the
number of changes, because a changeset naming ten packages writes its prose into
ten changelogs, so 67 changesets became 175 bullets carrying 67 distinct
sentences.

The detail is now all-or-nothing per release rather than trimmed at an arbitrary
entry. Every line keeps its sentence, its package, its pull request and its
author; only the folded prose goes, and the footer says where it is, since it is
in the changelogs either way. The same 67 changesets render at **37220**.

A release that fits is untouched. Regenerating v0.6.0 gives 7196 characters and
five `<details>` blocks, byte for byte what that release published.
