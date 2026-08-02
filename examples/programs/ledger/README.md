# Ledger

An expense report: claims in, what the company pays out.

```bash
venn run  examples/programs/ledger/main.vn
venn test examples/programs/ledger/tests.vn
```

```
category      │ claims │ claimed     │ paid
──────────────┼────────┼─────────────┼───────────
travel        │ 1      │ EUR 220.00  │ EUR 220.00
meals         │ 2      │ EUR 80.50   │ EUR 40.25
hardware      │ 1      │ EUR 899.00  │ EUR 899.00
entertainment │ 1      │ EUR 140.00  │ EUR 0.00
sabbatical    │ 1      │ EUR 3000.00 │ EUR 0.00

claimed EUR 4339.50 across 6 claims
paid    EUR 1159.25

no policy for: sabbatical
```

## The files

| file | what is in it |
| --- | --- |
| [`main.vn`](main.vn) | The program: the claims as they arrive, and the report. |
| [`policy/rules.vn`](policy/rules.vn) | What the company will pay for, and by how much. |
| [`policy/group.vn`](policy/group.vn) | Claims gathered into the lines of a table. |
| [`policy/mod.vn`](policy/mod.vn) | The face of the folder. |
| [`tests.vn`](tests.vn) | Eighteen assertions, written in Venn against Venn. |

`./policy` is a directory, and the program names the directory and nothing
inside it. Moving `rules.vn` or splitting it in two costs one line in `mod.vn`
and nothing anywhere else.

## What it leans on

**A rate is looked up, never read.** The table is private to the `namespace`, so
a category nobody wrote down is answered the same way everywhere rather than
differently in each place somebody forgot to check:

```ruby
pub namespace policy {
  const rates = { travel: 1.0, meals: 0.5, hardware: 1.0, entertainment: 0.0 }
  pub fn rateFor(category) => rates[category]
  pub fn covers(category) => rateFor(category) != null
}
```

**Text nobody promised was JSON.** Reading the claims is `try … else`, because a
file that is not what it should be is data being ordinary rather than an
exception. The `fn` that reads it answers an empty list; the program is what
refuses, one level up, because a `fn` is pure and refusing is a verb.

**A zero and an absence are not the same.** `entertainment` is covered at a rate
of zero, so it is in the table with `EUR 0.00`. `sabbatical` is not covered at
all, so it is named under the table instead. A report that showed both as zero
would be a report that hid the question.

**Order is kept on purpose.** Categories appear in the order they first arrive
rather than in whatever order a map hands back, because a report whose rows moved
between runs is a report nobody can diff.

## The tests are the language testing itself

[`tests.vn`](tests.vn) is `flow`, `step`, `fragment` and `expect` over the same
folder `main.vn` imports. Nothing about it is special-cased: a program written in
Venn is tested by a test written in Venn, against the same module.
