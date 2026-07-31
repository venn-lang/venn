# @venn-lang/notify

> The `notify` namespace: send a Slack message, a webhook or an email from a flow.

A run that fails at 3am is only useful if somebody hears about it. This plugin gives a flow three
dispatch verbs and routes all of them through the `Notifier` port, so the transport is chosen by the
host at startup. Under test that means a recorder you can assert against, with nothing leaving the
machine.

## Install

Nothing to install. `@venn-lang/notify` is part of the standard library, and the CLI and the language
server both load [`@venn-lang/stdlib`](../stdlib), which lists every stdlib plugin. A file reaches the
namespace with one line.

```ruby
import { notify } from "venn/notify"
```

## Usage

```ruby
module demo.checkout

import { notify } from "venn/notify"
import { assert } from "venn/assert"

flow "Checkout" {
  step "place the order" {
    expect true
  }

  on failure {
    notify.slack "#qa" { mention: "@oncall" }
  }
}
```

## Verbs

| Verb | Call | Options |
| --- | --- | --- |
| `notify.slack` | `notify.slack "#qa"` | `mention` |
| `notify.webhook` | `notify.webhook "https://hook.test/build"` | `json` |
| `notify.email` | `notify.email "qa@example.com"` | `subject`, `body` |

Each verb takes its destination as the one positional argument, the channel for Slack, the URL for a
webhook, the recipient for an email, and everything else as options:

```ruby
const posted  = notify.slack "#builds" { mention: "@oncall" }
const hooked  = notify.webhook "https://hook.test/build" { json: { status: "green" } }
const mailed  = notify.email "qa@example.com" { subject: "Nightly", body: "All green." }

expect posted.delivered == true
```

All three return `notify.Receipt`.

## The type it publishes

`notify.Receipt` is a record of `delivered: bool` and `id: string`. `delivered` is the dispatch, not
the reading: nobody here knows whether a human saw it.

## The Notifier port

| | |
| --- | --- |
| id | `venn.port.notifier` |
| version | 1 |
| requires | `net` |
| methods | `send` |

Two implementations ship together, which is what makes this a port rather than a module with a good
interface:

- `createFakeNotifier()` records every notification in memory and returns
  `{ delivered: true, id: "fake-<n>" }`. It is a `FakeNotifier`, so the recorded messages are
  readable through `sent`. This is the one [`@venn-lang/stdlib`](../stdlib) binds.
- `createRealNotifier()` is a stub. Every call throws a `VennError` with code `VN8090`, because this
  repository is the language and ships no live Slack, webhook or SMTP wiring.

Both run the same conformance suite, `notifierConformance` in `src/clients/notifier.suite.ts`: a
`send` resolves a receipt with a boolean `delivered` and a string `id`.

Asserting on what a flow sent, from TypeScript:

```ts
import { createFakeNotifier } from "@venn-lang/notify";

const notifier = createFakeNotifier();
await notifier.send({ kind: "slack", channel: "#qa", mention: "@vini" });

expect(notifier.sent[0]).toMatchObject({ kind: "slack", channel: "#qa" });
```

## API

| Export | What it is |
| --- | --- |
| `notifyPlugin` | The plugin definition: namespace `notify`, `requires: ["net"]`. Also the default export. |
| `notifyActions` | The three action definitions, in order: `slack`, `webhook`, `email`. |
| `NotifierPort` | The port descriptor. |
| `Notifier` | The port interface: `send(message)`. |
| `FakeNotifier` | A `Notifier` that also exposes `sent`, the notifications it recorded. |
| `Notification` | What is handed to the port: `kind`, `channel`, and the optional `subject`, `body`, `mention`, `json`. |
| `NotificationKind` | `"slack" \| "webhook" \| "email"`. |
| `NotifyReceipt` | What the port returns: `{ delivered, id }`. |
| `createFakeNotifier()` | The recording double. |
| `createRealNotifier()` | The real notifier, stubbed to throw `VN8090`. |

Binding a different notifier means one entry in the runner's port list:

```ts
import { createRunner } from "@venn-lang/runtime";
import { createFakeNotifier, NotifierPort } from "@venn-lang/notify";

const runner = createRunner({
  host,
  plugins,
  sink,
  uri,
  ports: [{ port: NotifierPort, impl: createFakeNotifier() }],
});
```

## See also

- [`@venn-lang/sdk`](../sdk) for `definePlugin` and `defineAction`.
- [`@venn-lang/contracts`](../contracts) for `Port`, `assertPortShape` and `VennError`.
- [`@venn-lang/artifacts`](../std-artifacts) for the traces and videos a failure leaves behind.
