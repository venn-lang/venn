---
"@venn-lang/core": minor
"@venn-lang/runtime": minor
"@venn-lang/cli": minor
---

`VN2021`: files that import each other are refused, with the way round shown.

```
VN2021 · Importing "./a.vn" here closes a circle.
  at    b.vn:1:1
  help  Move what both files need into another one, and import that from each.
  see   a.vn:1:1  imports b.vn
  see   b.vn:1:1  imports a.vn
```

They used to run. The walk skipped a file it had already seen, which ended the
loop and left one module half built: a `const` at the top of a file is evaluated
when the file is, and a `pub fn` closes over the file it was written in, so one
side reads what the other has not filled yet. Which side depends on which file
the run entered first.

The circle reads the same whichever file leads into it, so `venn check` over a
folder reports one mistake rather than one per door.

Two files importing the same third is not a circle, and never was.

`venn run` now refuses an import that leads nowhere too, which `venn check` has
said since `VN2019` but the runner did not.
