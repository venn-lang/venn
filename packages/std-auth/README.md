# @venn-lang/auth

> The `auth` namespace: build the header a request needs, or fetch a token for it.

Six of the seven verbs are pure computation, headers, signatures and codes worked out from what you
hand them. The seventh, `auth.oauth2`, is the one that talks to a token endpoint, and it goes
through the `AuthClient` port so the exchange is injected rather than hard-wired. Real cryptography
uses the global Web Crypto (`crypto.subtle`), so nothing here imports `node:*`.

## Install

Nothing to install. `@venn-lang/auth` is part of the standard library, and the CLI and the language
server both load [`@venn-lang/stdlib`](../stdlib), which lists every stdlib plugin. A file reaches the
namespace with one line.

```ruby
import { auth } from "venn/auth"
```

## Usage

```ruby
module demo.auth

import { auth } from "venn/auth"
import { assert } from "venn/assert"

flow "Signed in" {
  step "a bearer header carries the token" {
    const header = auth.bearer "tok123"
    expect header.Authorization == "Bearer tok123"
  }

  step "a service account gets a token" {
    const token = auth.oauth2 "svc-account" { grant: "client_credentials", scope: "orders:write" }
    expect token.expires_in > 0
  }
}
```

## Verbs

| Verb | Call | Result |
| --- | --- | --- |
| `auth.bearer` | `auth.bearer "tok123"` | `auth.Headers` |
| `auth.basic` | `auth.basic "alice" "s3cret"` | `auth.Headers` |
| `auth.apikey` | `auth.apikey "KEY" { header: "X-Token" }` | `auth.Headers` |
| `auth.hmac` | `auth.hmac "s3cret" "payload" { algo: "sha512" }` | `string`, lowercase hex |
| `auth.totp` | `auth.totp "seed" { at: 0, period: 30, digits: 6 }` | `string` |
| `auth.jwt` | `auth.jwt { payload: { sub: "42" }, secret: "k" }` | `string` |
| `auth.oauth2` | `auth.oauth2 "svc-account" { grant: "client_credentials" }` | `auth.Token` |

**`bearer`** returns `{ Authorization: "Bearer <token>" }`.

**`basic`** base64-encodes `user:pass` into `{ Authorization: "Basic <…>" }`.

**`apikey`** puts the key under a header of your choosing. The `header` option defaults to
`X-API-Key`, so `auth.apikey "KEY"` gives `{ "X-API-Key": "KEY" }`.

**`hmac`** takes the secret first and the payload second, so `auth.hmac "s3cret" "payload"` keys the
HMAC with `s3cret`. The `algo` option accepts `sha1`, `sha256`, `sha384` and `sha512`, case and
dashes ignored, and anything it does not recognise falls back to SHA-256.

**`totp`** computes an RFC 6238 code and is deterministic for a fixed `at`, which makes it usable in
a test. `at` is the time to compute at and `period` the step, both in seconds; `digits` defaults
to 6 and the result is zero-padded, which is why it is a string and not a number.

**`jwt`** takes nothing positionally. `payload` and `secret` are required options, `header` is
optional and is merged over the default `{ alg: "HS256", typ: "JWT" }`. The signature is HS256.

**`oauth2`** takes the principal positionally and `grant`, `tokenUrl`, `scope` and `refresh` as
options. It is the only verb here that reaches a port.

## The types it publishes

| Type | Shape |
| --- | --- |
| `auth.Headers` | `map<string>`. A map rather than a record, because `auth.apikey` names its own header and the key is only known at the call site. |
| `auth.Token` | `{ access_token, token_type, expires_in }`, the OAuth2 wire shape. |

## The AuthClient port

| | |
| --- | --- |
| id | `venn.port.auth-client` |
| version | 1 |
| requires | `net` |
| methods | `token` |

Two implementations ship together, which is what makes this a port rather than a module with a good
interface:

- `createFakeAuthClient()` returns a canned token derived from the principal, with no network. This
  is the one [`@venn-lang/stdlib`](../stdlib) binds, so `auth.oauth2` resolves offline. Pass
  `{ token: { expires_in: 60 } }` to override any field of what it hands back.
- `createRealAuthClient()` is a stub. Every call throws a `VennError` with code `VN8090`, because
  this repository is the language and ships no live token exchange.

Both run the same conformance suite, `authClientConformance` in `src/clients/auth-client.suite.ts`:
a `token` resolves with a string `access_token`, a string `token_type` and a numeric `expires_in`.

The plugin as a whole declares `requires: ["net"]`, so a host without the `net` capability is
refused with a legible diagnostic before the run starts, rather than failing somewhere inside
`auth.oauth2`.

## API

| Export | What it is |
| --- | --- |
| `authPlugin` | The plugin definition: namespace `auth`, `requires: ["net"]`. Also the default export. |
| `authActions` | The seven action definitions: `bearer`, `basic`, `apikey`, `hmac`, `totp`, `jwt`, `oauth2`. |
| `AuthClientPort` | The port descriptor. |
| `AuthClient` | The port interface: `token(request)`. |
| `OAuthTokenRequest` | What the port is asked: `principal`, and the optional `grant`, `tokenUrl`, `scope`, `refresh`. |
| `OAuthToken` | What it answers: `{ access_token, token_type, expires_in }`. |
| `createFakeAuthClient({ token? })` | The deterministic double. |
| `createRealAuthClient()` | The real client, stubbed to throw `VN8090`. |
| `Token` | The Zod schema registered as the plugin's nominal `Token` type. |
| `authTypeDefs` | The `TypeSpec`s for `auth.Headers` and `auth.Token`, which the checker and the LSP read. |

Binding a different client means one entry in the runner's port list:

```ts
import { AuthClientPort, createFakeAuthClient } from "@venn-lang/auth";
import { createRunner } from "@venn-lang/runtime";

const runner = createRunner({
  host,
  plugins,
  sink,
  uri,
  ports: [{ port: AuthClientPort, impl: createFakeAuthClient() }],
});
```

## See also

- [`@venn-lang/http`](../std-http) for the requests these headers are attached to.
- [`@venn-lang/crypto`](../std-crypto) for hashing and encoding outside an auth flow.
- [`@venn-lang/sdk`](../sdk) for `definePlugin` and `defineAction`.
