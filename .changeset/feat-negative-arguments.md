---
"@venn-lang/core": minor
---

Let an argument be negative: `print total -1` is two of them.

Brackets after a value are always a call, which is what makes `conn.close()`
work, so `print total (-1)` called `total` and a negative value in any position
but the first had no spelling at all.

How the `-` is written is what tells the two readings apart, the way Swift tells
them apart: tight against the value with air before it, it negates; spaced on
both sides or on neither, it is the operator, and an argument holds no operator,
so the message that says to bracket it still says so.
