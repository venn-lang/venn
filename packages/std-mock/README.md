# @venn-lang/mock

> The `mock` namespace: named mocks, HTTP interceptors, feature flags and a virtual clock.

Eight verbs writing to one in-process state object, which the runner hands back at the start of
every flow, so what a flow pretends is true belongs to that flow. There is no port and no network
here: the whole package is a typed way to record what a run should pretend, and a way to read that
record back from TypeScript.

## Install

The package ships with the stdlib, so the CLI already loads it. Inside a `.vn` file, bring the
namespace in with `import`:

```ruby
import { mock } from "venn/mock"
```

## Usage

```ruby
module demo.checkout

import { mock } from "venn/mock"

setup {
  mock.start "payments" { from: "./mocks/stripe.yaml" }
  mock.intercept "POST" "**/charge" { respond: { status: 201, body: { id: "ch_1" } } }
  mock.flag "new-checkout"
  mock.flag "rollout" { value: 0.5 }
}

teardown { mock.reset }

flow "Checkout" {
  step "hold time still" {
    mock.clock.freeze 2026-07-23T12:00:00Z
    let now = mock.clock.advance 1h
    expect now > 0
  }
}
```

## Verbs

| Verb | Positional arguments | Options | Result |
| --- | --- | --- | --- |
| `mock.start` | `name: string` | `from` | `mock.Mock` |
| `mock.stop` | none | none | `void` |
| `mock.intercept` | `method: string`, `url: string` | `respond` | `mock.Interceptor` |
| `mock.respond` | `status: number`, `body: dynamic` | `status`, `body` | `mock.Response` |
| `mock.clock.freeze` | `at: string \| number \| instant` | none | `number`, epoch ms |
| `mock.clock.advance` | `by: string \| number \| duration` | none | `number`, the new virtual now |
| `mock.flag` | `name: string` | `value` | `dynamic`, the value that was set |
| `mock.reset` | none | none | `void` |

Notes that matter in practice:

- `mock.stop` clears the registered mocks and interceptors but leaves flags and the clock alone.
  `mock.reset` clears everything, including the frozen instant.
- `mock.flag "x"` with no `value` sets the flag to `true`.
- `mock.respond` accepts its two values positionally or by name, so
  `mock.respond 201 { body: { ok: true } }` and `mock.respond { status: 201, body: { ok: true } }`
  record the same thing. The `respond` option of `mock.intercept` takes either a full
  `{ status, body }` map or a bare value, which is wrapped as a `200`.
- The clock verbs read the language's own literals. `mock.clock.freeze 2026-07-23T12:00:00Z` and
  `mock.clock.advance 1h` pass an instant and a duration value, not strings, and both are understood.
  An ISO string or a raw millisecond count works too.
- Freezing records the instant in mock state. It does not drive the host clock, and no other stdlib
  plugin reads the interceptors yet: the state is a record, and TypeScript is what reads it.
- Option names come from each verb's schema, so a typo is `VN3001` with a "did you mean" hint before
  the flow runs.

## Types

| Name | Shape |
| --- | --- |
| `mock.Mock` | `{ name: string, from?: string }` |
| `mock.Interceptor` | `{ method: string, path: string, respond: mock.Response }` |
| `mock.Response` | `{ status: number, body: dynamic }` |

## Reading the state back

Every verb reads and writes one `MockState`, replaced at the start of every flow. A test that
drives the plugin from TypeScript inspects it directly:

```ts
import { getMockState, resetMockState } from "@venn-lang/mock";

resetMockState();
// ... run the flow ...
const state = getMockState();
state.flags.get("new-checkout"); // true
state.intercepts[0]?.respond; // { status: 201, body: { id: "ch_1" } }
state.frozenInstant; // epoch ms, or undefined while the clock is live
```

`resetMockState()` replaces the state with a fresh one, which is exactly what the `mock.reset`
verb does and what the plugin hands the runner as its `atFlowStart`. Call it in a `beforeEach` so
one test's flags never reach the next.

## API

| Export | What it is |
| --- | --- |
| `mockPlugin` (also the default export) | The `PluginDefinition`: namespace `mock`, no required capability, eight actions. |
| `mockActions` | The action list, in registration order. |
| `getMockState()` | The live `MockState` the verbs read and write, one flow at a time. |
| `resetMockState()` | Replaces it with a fresh, empty state. |
| `createMockState()` | Builds a fresh, empty state without touching the shared one. |
| `MockState`, `NamedMock`, `Interceptor`, `MockResponse` | Types only. |

## See also

- [`@venn-lang/http`](../std-http), whose verbs the interceptors are written for.
- [`@venn-lang/data`](../std-data), for deterministic fake values.
- [`@venn-lang/sdk`](../sdk), `defineAction` / `definePlugin`.
