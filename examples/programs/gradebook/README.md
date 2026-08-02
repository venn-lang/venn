# Gradebook

Weighted marks in, grades and a class summary out, and the rows it will not
grade said out loud.

```bash
venn run  examples/programs/gradebook/main.vn
venn test examples/programs/gradebook/tests.vn
```

```
student │ average │ grade
────────┼─────────┼──────
ada     │ 91.4    │ A
grace   │ 85.4    │ B
barbara │ 97.9    │ A

class average 91.6, best 97.9

not graded:
  alan: midterm is 110, not a percentage (grade.refused)
  edsger: no final (grade.refused)
```

## The files

| file | what is in it |
| --- | --- |
| [`main.vn`](main.vn) | The program: the term as it was filed, and the report. |
| [`marks/scheme.vn`](marks/scheme.vn) | What a term is worth and how a row is judged. |
| [`marks/row.vn`](marks/row.vn) | What one student's marks look like. |
| [`marks/mod.vn`](marks/mod.vn) | The face of the folder. |
| [`tests.vn`](tests.vn) | Twenty assertions, mostly about the rows that are wrong. |

## What it is about

Bad data. A term's marks arrive from four teachers and one of them will have
typed 110, left a component out, or filed a student twice. A program that
averages that silently is worse than one that stops.

**The pure part answers, and the program refuses.** `problemWith` says what is
wrong with a row, or nothing when it can be graded:

```ruby
pub fn problemWith(row) {
  forEach part in parts() {
    const mark = row.marks[part]
    if mark == null {
      return "no ${part}"
    }
    if mark < 0 || mark > 100 {
      return "${part} is ${mark}, not a percentage"
    }
  }
  return null
}
```

A value or nothing, in one block, with two early exits. That is the ordinary
shape of anything that looks something up, and until
[#223](https://github.com/venn-lang/venn/issues/223) it did not type-check: this
function was four functions folded through a `reduce`.

**The refusal carries a code.** `fail` with `grade.refused` and the student in
its data, caught where the report is written, so a caller can tell a typo from a
missing mark without reading the sentence.

**The marks are a `map<number>`, not a shape with three fields.** A row missing a
component is the point of the program, so a type demanding all three would
refuse the one row worth looking at.

**The tests are mostly about failure.** Twenty assertions, and the ones that
earn their place are the band edges (`89.9` is a B, `90` is an A) and the rows
with something wrong in them. A gradebook that only knows about good data is a
gradebook that has not been tested.
