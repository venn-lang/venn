---
"@venn-lang/contracts": minor
"@venn-lang/sdk": minor
"@venn-lang/runtime": minor
"@venn-lang/project": minor
"@venn-lang/cli": minor
---

Every `VNxxxx` a package raises is declared in a catalogue, and a test refuses
one that is not.

The kernel's catalogue said it held "every VNxxxx the kernel itself can raise".
Twenty-three were written where they were thrown, across nine packages,
including one in `VN9xxx`, a family the specification does not define.

Five catalogues now: the kernel's, the host and its ports, the two every plugin
shares, the runtime's own, and the project tooling's. A plugin does not invent a
family. It uses the one that matches the kind of failure, with a high number in
that range so it cannot meet a kernel code.

A stack overflow used to arrive as the machine's own sentence, with no code at
all. It is `VN8003` now, and reads as what happened:

```
VN8003  This went too deep: something calls itself and never stops.
```
