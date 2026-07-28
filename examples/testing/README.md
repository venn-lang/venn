# Testing

The reason Venn exists. These ten files start at a single `flow` with one
expectation and end at the scheduler features that make a suite worth having:
lifecycle hooks, expected failures, concurrency and matrices. Read them in
order; each one assumes the ones before it and nothing else.

| file | what it shows |
| --- | --- |
| [`01-first-flow.vn`](01-first-flow.vn) | `flow`, `step`, and `expect` over a boolean expression |
| [`02-steps.vn`](02-steps.vn) | steps as the unit of reporting, and what each one can see |
| [`03-matchers.vn`](03-matchers.vn) | `equals`, `contains`, `oneOf`, `closeTo`, `not`, `expect.all`, `expect.soft` |
| [`04-groups.vn`](04-groups.vn) | `group` for organising, plus `@tags`, `@timeout`, `@retry`, `@skip` |
| [`05-fragments.vn`](05-fragments.vn) | a `fragment` reused across flows with `run … as` |
| [`06-lifecycle.vn`](06-lifecycle.vn) | `setup`, `teardown`, `beforeEach`, `afterEach`, `defer`, `on`, and their order |
| [`07-expected-failure.vn`](07-expected-failure.vn) | `try`/`catch`/`finally` when the failure is the thing under test |
| [`08-fakes.vn`](08-fakes.vn) | `@venn-lang/mock`: canned replies, feature flags, a clock you control |
| [`09-concurrency.vn`](09-concurrency.vn) | `parallel`, `race`, and `forEach { concurrency: 4 }` |
| [`10-matrix.vn`](10-matrix.vn) | `matrix` running one flow across every variant |

Run them with:

```bash
venn test examples/testing/01-first-flow.vn
```

Or the whole section at once:

```bash
venn test examples/testing/
venn check examples/testing/
```

Notes worth having before you start:

- Use `venn test`, not `venn run`. `run` executes a file's statements top to
  bottom; a file whose content is `flow` declarations does nothing under it.
- Nothing here touches the network. Every assertion is against a value the file
  computes, or against `@venn-lang/mock`, so the suite runs anywhere.
- `venn list examples/testing/` prints the flows and steps that would run
  without running them.
- `log` shows up under its step in the default reporter. `print` is the
  program's own output and belongs in a `venn run` script, not in a flow.
  `--reporter=ndjson` shows every event, hooks included, which is how
  [`06-lifecycle.vn`](06-lifecycle.vn) is meant to be read.
- Step titles are literal. `step "checks ${user.name}"` reports the `${…}` as
  written, so put the variable part in a `log` line inside the step.
