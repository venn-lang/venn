# @venn-lang/load

> The `load` namespace: describe a load profile, run it, assert on the metrics.

Three builders turn a sentence about traffic into a profile value, and a fourth verb hands that
profile to the `LoadRunner` port and gives you back latency percentiles and an error rate. The
profile is plain data, so a flow can hold it, pass it and read it before anything is driven.

## Install

Nothing to install. `@venn-lang/load` is part of the standard library, and the CLI and the language
server both load [`@venn-lang/stdlib`](../stdlib), which lists every stdlib plugin. A file reaches the
namespace with one line.

```ruby
import { load } from "venn/load"
```

## Usage

```ruby
module demo.load

import { load } from "venn/load"
import { assert } from "venn/assert"

flow "Checkout under load" {
  step "ramp to 200 VUs" {
    const profile = load.ramp 0 200 { over: "30s", hold: "5m" }
    const metrics = load.run profile

    expect metrics.p95 < 800
    expect metrics.errorRate < 0.05
  }
}
```

## Verbs

| Verb | Call | Result |
| --- | --- | --- |
| `load.ramp` | `load.ramp 0 200 { over: "30s", hold: "5m" }` | `load.Ramp` |
| `load.constant` | `load.constant 50 { over: "10s" }` | `load.Constant` |
| `load.spike` | `load.spike 500 { at: "5s" }` | `load.Spike` |
| `load.run` | `load.run profile` | `load.Metrics` |

The three builders are pure: they compute a descriptor and touch nothing. Only `load.run` reaches
the port.

`load.ramp` takes two positional arguments, the virtual users it starts from and the number it ends
at. The spec's `0 -> 200` arrow sugar is not in the grammar.

**Durations are written as strings.** `over`, `hold` and `at` are read by the SDK's `Duration`
schema, which accepts `"30s"`, `"2m"` or a plain count of milliseconds and yields milliseconds. The
language's own `30s` unit literal is a different value, and passing it is refused before the run
with `"over" is not a valid option`. Write `{ over: "30s" }` or `{ over: 30000 }`.

## The types it publishes

| Type | Shape |
| --- | --- |
| `load.Ramp` | `{ kind: "ramp", from, to, over?, hold? }` |
| `load.Constant` | `{ kind: "constant", vus, over? }` |
| `load.Spike` | `{ kind: "spike", peak, at? }` |
| `load.Profile` | Whichever of the three a builder produced. This is what `load.run` takes. |
| `load.Metrics` | `{ vus, rps, p50, p95, p99, errorRate }` |

The durations inside a profile are numbers, not durations: `Duration` already turned `"30s"` into
`30000` on the way in, so what a profile holds is a count of milliseconds.

## The LoadRunner port

| | |
| --- | --- |
| id | `venn.port.load-runner` |
| version | 1 |
| requires | `net` |
| methods | `run` |

Two implementations ship together, which is what makes this a port rather than a module with a good
interface:

- `createFakeLoadRunner()` derives canned metrics from the profile's peak VUs, with no real traffic.
  This is the one [`@venn-lang/stdlib`](../stdlib) binds, so a load flow is runnable offline.
- `createRealLoadRunner()` is a stub. Every call throws a `VennError` with code `VN8090`, because
  this repository is the language and drives no real load.

Both run the same conformance suite, `loadRunnerConformance` in `src/runner/load-runner.suite.ts`,
which holds them to two invariants: `p50 <= p95 <= p99`, and the reported `vus` is the profile's
peak.

## API

| Export | What it is |
| --- | --- |
| `loadPlugin` | The plugin definition: namespace `load`, `requires: ["net"]`. Also the default export. |
| `rampProfile({ from, to, over?, hold? })` | Builds a `RampProfile`. |
| `constantProfile({ vus, over? })` | Builds a `ConstantProfile`. |
| `spikeProfile({ peak, at? })` | Builds a `SpikeProfile`. |
| `peakVus(profile)` | The peak concurrent VUs a profile reaches, which is what a runner drives toward. |
| `RampProfile`, `ConstantProfile`, `SpikeProfile` | The three descriptor types. |
| `LoadProfile` | Their union: what the runner consumes. |
| `LoadRunnerPort` | The port descriptor. |
| `LoadRunner` | The port interface: `run(profile)`. |
| `createFakeLoadRunner()` | The fake runner. |
| `createRealLoadRunner()` | The real runner, stubbed to throw `VN8090`. |
| `LoadMetrics` | The metrics type. |
| `LoadMetricsSchema` | The Zod schema registered as the plugin's nominal `LoadMetrics` type. |

Binding a different runner means one entry in the runner's port list:

```ts
import { createFakeLoadRunner, LoadRunnerPort } from "@venn-lang/load";
import { createRunner } from "@venn-lang/runtime";

const runner = createRunner({
  host,
  plugins,
  sink,
  uri,
  ports: [{ port: LoadRunnerPort, impl: createFakeLoadRunner() }],
});
```

## See also

- [`@venn-lang/sdk`](../sdk) for `definePlugin`, `defineAction` and the `Duration` schema.
- [`@venn-lang/http`](../std-http) for the requests a load profile is usually pointed at.
- [`@venn-lang/artifacts`](../std-artifacts) for filing what a run produced.
