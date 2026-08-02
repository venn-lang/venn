---
"@venn-lang/core": patch
---

Reserved two lint codes: `VN5007_OPTIONS_NOT_A_VALUE` for a trailing map
literal read as a verb's options block when it was meant as a value, and
`VN5008_CONCURRENCY_IN_A_PURE_BODY` for a `concurrency` option on a `forEach`
inside a `fn`, where a pure body runs one pass at a time and the option is
ignored. Neither is raised yet.
