# @venn-lang/mail

> The `mail` namespace: five verbs for waiting on an inbox and reading what arrived.

Half of an end-to-end test lands in an email: a verification code, a password reset link, an invoice PDF. This package adds the vocabulary for that as a plugin, exactly the way a third-party package would add it. The verbs never speak SMTP or IMAP themselves. Each one calls a `MailClient`, a port with two implementations, so the same flow runs against a real backend or against a deterministic in-memory inbox.

## Install

Nothing to install: the plugin ships inside the CLI's stdlib. Declare it in the file that needs it, and the runner loads it.

```ruby
use "venn/mail"
```

## Usage

```ruby
module demo.signup

use "venn/mail"
use "venn/assert"

flow "Signup sends a verification email" {
  step "wait for the message" {
    mail.inbox "mailpit"

    const email = mail.waitFor { to: "ada@example.test", subject: "verification code" }
    expect email.subject contains "verification code"

    const body = mail.read
    expect body contains "Welcome"

    const files = mail.attachments
    expect files.len == 1

    mail.clear
  }
}
```

`waitFor` selects the email the following verbs read. Call it before `read` or `attachments`, or they fail with `VN7090` saying no email is selected.

## Verbs

The namespace is `mail`. `inbox` takes its argument positionally; `waitFor` takes everything as options.

| Verb | Gives back |
| --- | --- |
| `mail.inbox "name"` | the inbox name, so a flow can bind it and read later which one it is on |
| `mail.waitFor { to, subject, within }` | `mail.Email` |
| `mail.read` | the current email's body, as a string |
| `mail.attachments` | `list<mail.Attachment>` |
| `mail.clear` | nothing |

`subject` matches as a substring, so `{ subject: "verification code" }` finds `"Your verification code is 246813"`. `to` matches exactly. Both are optional; omitting them matches the first email in the inbox.

`within` is the deadline, written as a string or as a number of milliseconds (`{ within: "30s" }`, `{ within: 30000 }`). A bare duration literal is not accepted there in this build.

## Types

The plugin publishes two names under `mail.`, as Zod schemas for validation and as `TypeSpec` data for the editor and the node graph.

| Type | Shape |
| --- | --- |
| `mail.Email` | `{ to, subject, body, attachments }` |
| `mail.Attachment` | `{ filename, contentType, size }` |

An attachment carries its metadata only. The bytes stay at the backend.

## The port

One port, with a real implementation and a double, which is the condition for being a port at all.

`MailClientPort` is `venn.port.mail-client`, contract version 1, requiring the `net` capability. Five methods: `selectInbox`, `waitFor`, `read`, `attachments`, `clear`. Every action reaches it through `ctx.port(MailClientPort)`, so a verb never knows which backend is underneath.

| Implementation | What it is |
| --- | --- |
| `createFakeMailClient({ inbox })` | A deterministic in-memory inbox, preloaded with the emails a test needs. |
| `createRealMailClient()` | The real-backend stub. Every method throws `VN8090`, because backend integration is out of scope for the language repository. |

```ts
import { createFakeMailClient } from "@venn-lang/mail";

const client = createFakeMailClient({
  inbox: [
    {
      to: "ada@example.test",
      subject: "Password reset code 9182",
      body: "hello",
      attachments: [{ filename: "a.pdf", contentType: "application/pdf", size: 1 }],
    },
  ],
});

const email = await client.waitFor({ subject: "reset code" });
await client.read();          // "hello"
await client.attachments();   // one attachment
```

Both implementations answer to one conformance suite, `mailClientConformance` in `src/clients/mail-client.suite.ts`: substring matching on the subject, `read` and `attachments` following the current email, and `clear` leaving nothing behind. The suite is the specification; the prose here is a comment on it.

Failures are `Problem` objects with stable codes. `VN8091` when no email matched the query, and its detail carries the query that found nothing. `VN7090` when `read` or `attachments` is called before `waitFor`. `VN8090` from the real client, on every method, until it is implemented.

## API

| Export | What it is |
| --- | --- |
| `mailPlugin` (also the default export) | The `PluginDefinition`: namespace `mail`, requires `net`, carrying the actions and types. |
| `MailClientPort`, `MailClient` | The port descriptor and its interface. |
| `MailQuery` | The `waitFor` query: `to`, `subject`, `within` in milliseconds. |
| `createFakeMailClient`, `createRealMailClient` | The two implementations. |
| `Email`, `Attachment` | The TypeScript types behind the published names. |
| `EmailSchema`, `AttachmentSchema` | The Zod schemas the plugin registers for them. |
| `mailTypeDefs` | The same two types as `TypeSpec` data, for the editor and the node graph. |

## Binding a client

A host chooses the implementation once, at startup. `@venn-lang/stdlib` binds an empty fake inbox, which is why the Usage flow above needs a client of its own to pass. Pass a binding to override it.

```ts
import { createFakeMailClient, MailClientPort } from "@venn-lang/mail";
import { createRunner } from "@venn-lang/runtime";

const runner = createRunner({
  host,
  plugins,
  sink,
  ports: [
    {
      port: MailClientPort,
      impl: createFakeMailClient({
        inbox: [
          {
            to: "ada@example.test",
            subject: "Your verification code is 246813",
            body: "Welcome to Venn.",
            attachments: [],
          },
        ],
      }),
    },
  ],
});
```

`MailClientPort` requires `net`. A host that does not offer it fails at bind time with a readable problem, rather than with a `TypeError` in the middle of a flow.

## See also

- [`@venn-lang/sdk`](../sdk) for `definePlugin` and `defineAction`, the API this package is built on.
- [`@venn-lang/contracts`](../contracts) for `Port`, `Host` and capability negotiation.
- [`@venn-lang/stdlib`](../stdlib) for the plugin list and the default port bindings the CLI runs with.
- [`@venn-lang/browser`](../std-browser) for the sibling plugin whose flows trigger the emails checked here.
