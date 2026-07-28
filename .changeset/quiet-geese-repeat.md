---
"@venn-lang/cli": minor
---

Add `venn upgrade`, which moves a global install to the latest published version.

It finds which of npm, pnpm, yarn or bun installed the running copy by reading the path it lives in,
then runs that manager's own global install. A copy the project owns is left alone, since its version
is pinned in the manifest, and a path matching no manager is refused rather than guessed at. Use
`--dry-run` to see the command without running it, or `--yes` to skip the confirmation in a script.
