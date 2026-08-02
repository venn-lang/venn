---
"@venn-lang/core": patch
"@venn-lang/sdk": patch
---

Five codes reserved ahead of the fixes that will raise them: `VN2023` for a
name a `deco` body reaches for before expansion has bound it, `VN5006` for
`==` or `!=` between two lists or two maps (reference equality, always
false), and `VN7022`, `VN7023`, `VN7024` for a connection refused, a host
that did not resolve, and a request that timed out.
