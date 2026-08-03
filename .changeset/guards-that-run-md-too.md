---
"@venn-lang/cli": patch
---

A guard nobody can walk past by editing a README.

Markdown was classified as prose, so a pull request that touched only `.md`
skipped every check. Three of the guards this epic adds read Markdown: one
requires a package to have a README, one requires a Venn block in it that
checks, and one refuses a dash or a credited tool in any file. Skipping them on
a change to the very files they are about is a guard with a door in it.

The neutrality guard learned both spellings of a Node module. `from "fs"` is the
same import as `from "node:fs"` to Node and to tsdown, so a guard that only knew
the prefixed one could be walked past by dropping four characters, and
`@venn-lang/contracts/node` is the one subpath the charter says carries `node:*`,
so reaching it from a neutral entry is the same leak one package along.
