# Pantry

A week of meals against what is in the cupboard, and what to do about the rest.

```bash
venn run  examples/programs/pantry/main.vn
venn test examples/programs/pantry/tests.vn
```

```
item    │ needs │ shelf
────────┼───────┼──────
rice    │ 300g  │ 900g
lentils │ 950g  │ 400g
cumin   │ 45g   │ 40g
tomato  │ 450g  │ 300g
spinach │ 300g  │ 250g
paneer  │ 400g  │ 0g

Short of 5 of the 6.

Ordering:
  150g of tomato
  5g of cumin

Not ordering:
  lentils: one case of lentils holds 500g. Order 2 cases.
  paneer: nobody carries it, cook with chickpeas
  spinach: nobody carries it, cook with chard
```

## The files

| file | what is in it |
| --- | --- |
| [`main.vn`](main.vn) | The program: the week, the shopping list, and what came back refused. |
| [`larder/shelf.vn`](larder/shelf.vn) | The cupboard and the recipes. Pure. |
| [`larder/plan.vn`](larder/plan.vn) | What the week takes, what is short, what stands in. Pure. |
| [`larder/supplier.vn`](larder/supplier.vn) | The one thing here that leaves the kitchen, and the two ways it refuses. |
| [`larder/mod.vn`](larder/mod.vn) | The face of the folder. |
| [`tests.vn`](tests.vn) | Thirty-two assertions, and no supplier. |

## What it is about

Failing, and carrying on. Ordering is the only act in the program and it is the
only thing that can refuse, so everything else is arranged around what happens
when it does.

**Two codes, not one sentence.** `order` fails with `pantry.unlisted` when the
supplier does not carry a thing at all, and with `pantry.caseSize` when the
amount is more than one case holds. The caller does genuinely different things
about them: one needs a different recipe, the other needs two cases. One code for
both would make `main.vn` read `e.message` to decide, and a sentence somebody
wrote for a person is not an interface.

**A refusal is answered where it happens.** The `try` sits inside the loop over
the shortfall, so one item nobody carries costs that item and nothing else. The
shopping list is still wanted, and a program that stopped at the first refusal
would be a program that never finishes a real week.

**Three files behind one name.** `larder/mod.vn` hands on nine names out of the
eleven the three files publish; `withMore` and `listing` stay inside. That is the
whole reason a folder has a face: either of those can be rewritten without a
caller noticing.

**The line between the halves is drawn by the language.** A `fn` is pure and
cannot fail, so `shelf.vn` and `plan.vn` are `fn` all the way down and `tests.vn`
asks them questions with no supplier standing anywhere. `order` is a `fragment`
because it is an act, and a `fragment` is the only thing that can `fail`.
