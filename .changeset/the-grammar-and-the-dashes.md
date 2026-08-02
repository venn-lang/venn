---
"@venn-lang/core": patch
---

§21 is the grammar, and a test holds it there.

The section is headed "this is the whole file". It held twenty-seven of the
seventy-six rules, listed three that had been removed (`FactoryDecl`,
`ReportDecl`, `WhileStmt`), and showed `LetStmt` as `'let' name=ID '=' value=Expr`,
with no `pub`, no `const`, no pattern, no declared type and no trailing
arguments. Three milestones were missing from the document that says it is the
specification.

The block is now generated from `venn.langium` by
`node scripts/grammar-section.mjs --write`, and a test refuses any difference
between the two, so it cannot drift again.

The em dash is gone from every file git tracks: two hundred and seventy-four of
them across sixty-eight files, each sentence rewritten around a comma, a colon,
a bracket or a full stop. A test keeps it that way, because a rule nobody checks
is a rule that comes back.
