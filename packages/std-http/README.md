# @venn-lang/http

> The `http` namespace: seven request verbs, a server, and the two ports they ride.

Venn's grammar knows no verbs. `@venn-lang/http` registers the `http` namespace with the runtime, so
`http.get` resolves to an action, `res` gets a known shape, and the editor can complete and document
both. The plugin itself never touches the network: requests go through the `HttpClient` port and
servers through the `HttpServer` port, so the CLI binds `fetch` and a real socket while a test binds
a fake and stays offline.

## Install

Nothing to install yet. The package is unpublished (version `0.0.0`) and ships inside
`@venn-lang/stdlib`, which the `venn` CLI and the language server both load. A `.vn` file declares it:

```ruby
import { http } from "venn/http"
```

## Usage

```ruby
module demo.api

import { header, http } from "venn/http"

config { baseUrl: "https://api.test" }

flow "Health" {
  step "the service answers" {
    const res = http.get "/health"
    expect res.status == 200
    expect res.ok
    expect res header "content-type"
  }
}
```

A relative path is joined onto `config.baseUrl`; a URL with a scheme passes through untouched.

## API

Everything below is exported from the package barrel.

| Export | What it is |
| --- | --- |
| `httpPlugin` (also the default export) | The `PluginDefinition`: namespace `http`, `requires: ["net"]`. |
| `HttpClientPort` | `Port<HttpClient>`, id `venn.port.http-client`, version 1, method `request`. |
| `createFetchClient()` | The real client, backed by the global `fetch`. |
| `createFakeClient({ responses, failures, latency })` | The double: canned responses keyed by URL, `okResponse()` for anything else. |
| `okResponse(overrides?)` | A `200` response with body `{"ok":true}`, for seeding the fake. |
| `HttpServerPort` | `Port<HttpServer>`, id `venn.port.http-server`, version 1, method `listen`. |
| `createMemoryServer()` | The double: no socket, and `deliver(request)` to knock on its door. |
| `serveAction()`, `onAction()` | The two `ActionDefinition`s behind `http.serve` and `http.on`. |
| `portInUse`, `listenFailed`, `asListenError` | `VennError` producers for `VN7020` and `VN7021`. |
| `connectionRefused`, `portNotAllowed`, `hostNotFound`, `requestTimedOut` | `VennError` producers for `VN7022`, `VN7023` and `VN7024`. |
| `requestFailed({ attempt, failure })` | One of the three, whichever implementation raised it. |
| `asRequestError({ attempt, error })` | Whatever `fetch` threw, as the error to raise. |

Types: `HttpClient`, `HttpRequest`, `HttpResponse`, `HttpFailure`, `Attempt`, `HttpServer`,
`RequestHandler`, `RunningServer`, `ServerRequest`, `ServerReply`, `ServeHandle`, `MemoryServer`,
`MemoryHttpServer`.

The subpath `@venn-lang/http/node` carries the one file that imports `node:*`:

```ts
import { createNodeServer, type NodeHttpServer } from "@venn-lang/http/node";
```

`createNodeServer()` binds a real socket and adds `closeAll()`, so whoever owns the process can give
its sockets back on the way out. Keeping it behind a subpath is what lets the main entry stay neutral
and run in the editor's worker.

## Verbs

| Verb | Shape | Result |
| --- | --- | --- |
| `http.get` `http.post` `http.put` `http.patch` `http.delete` `http.head` `http.options` | `http.get url { … }` | `http.Response` |
| `http.serve` | `http.serve { port, host }` | `http.Server` |
| `http.on` | `http.on(server, handler)` | nothing |

Every request verb takes the URL as its one positional argument. The rest is the trailing options map:

| Option | Meaning |
| --- | --- |
| `headers` | Extra headers. Anything set here wins over what Venn would infer. |
| `query` | Appended to the URL as a query string, encoded for you. |
| `body` | What to send. A map becomes JSON; a string is sent as written. |
| `encode` | `json`, `form`, `multipart` or `raw`. Defaults to `json` for a map, `raw` for a string. |
| `bearer` | Shorthand for `Authorization: Bearer …`. |
| `basic` | `{ user, pass }`, as HTTP basic auth. Base64 of the **UTF-8** bytes of `user:pass`, which is what RFC 7617 §2 requires. |

`basic` used to call `btoa`, which encodes latin-1: `{ basic: { user: "user", pass: "señha" } }` went
onto the wire as `dXNlcjpzZfFoYQ==` rather than `dXNlcjpzZcOxaGE=`, so the server read a different
password, answered 401, and nothing in Venn said why. A password outside latin-1 threw a
`DOMException` with no `VNxxxx` code and no line. The encoder now lives in
[`@venn-lang/sdk`](../sdk), so `http.get "…" { basic: … }` and `auth.basic` produce the same header
byte for byte.

`http.serve` takes `port` (`0` asks for any free one) and `host` (defaults to `127.0.0.1`).

## Serving

A server is not a request-response verb: it stays, and the requests arrive afterwards. So `http.serve`
hands back a handle, and `http.on` says what to answer with.

```ruby
import { http } from "venn/http"

const api = http.serve { port: 0 }
defer { api.close() }

http.on(api, route)

fn route(req) {
  const path = req.url.before("?")
  path == "/health" ? { ok: true, method: req.method } : { status: 404 }
}

print "listening on http://127.0.0.1:${api.port}"
```

The handler is an ordinary `fn`, so everything the language does works inside it. A map carrying
`status`, `headers` or `body` is taken as a reply; anything else becomes the body of a `200`;
returning nothing sends `204`. Until `http.on` runs, the server answers `404`, so a request that
arrives early gets an answer instead of hanging.

## Matchers and types

`header` is the one matcher: `expect res header "content-type"` passes when the response carries that
header, and `expect res header "content-type" "application/json"` passes when it says exactly that.
The name is read in whatever case the far end sent it; the value is compared exactly.

The plugin publishes four types to the checker: `http.Response` (`status`, `ok`, `headers`, `body`
as raw text, `json` as that text parsed, `time`), `http.Request`, `http.Reply` and `http.Server`.
`json` is the one field nothing can know the shape of, so give it one by naming it:
`const price: Price = res.json`.

`time` is the whole milliseconds the round trip took, from the request going out to the body being
in hand. Both implementations measure it, and neither reads it off a canned response, so
`expect res.time < 2s` asks about the service and not about the double. To make the double slow,
give it a `latency`, which it really waits.

## When a request fails

A request that never got an answer raises a `VennError` with a code, never the host runtime's
`fetch failed`:

| Code | When | What it says |
| --- | --- | --- |
| `VN7022` | Nothing accepted the connection | `Nothing is listening on 127.0.0.1:8080, so GET http://127.0.0.1:8080/health was refused.` |
| `VN7022` | A port no client will open, such as `1` | `Port 1 is one no HTTP client will open, so GET http://127.0.0.1:1/health never went out.` |
| `VN7023` | The name did not resolve | `The name api.invalid did not resolve, so GET http://api.invalid/health had nowhere to go.` |
| `VN7024` | It went out and nothing came back | `GET http://10.255.255.1/health ran out of time after 11113ms without an answer.` |

The translation lives at the producer, beside the client: `fetch` reports every network failure as
`TypeError: fetch failed` and puts the reason on `cause`, and no caller should have to read an
errno to learn that nothing was listening. A failure with no name of its own is handed on untouched
rather than dressed in a code that says something specific and false, which is also what keeps a
`race` cancelling a request from looking like a request that failed.

The double raises the same three, so a flow's `catch` can be tested offline:

```ts
createFakeClient({ failures: { "https://api.test/health": "refused" } });
```

## Ports and conformance

Two ports, each with two implementations and a suite both must pass:

- `HttpClient`: `createFetchClient` and `createFakeClient`, checked by
  `src/clients/http-client.suite.ts`. The test stubs the global `fetch` so the real client's mapping
  runs the same suite offline: the response shape, `time` reporting a delay the client was made to
  take, and each of the three failures with its own code. A second test fails a real loopback
  connection, so the stubbed shapes cannot drift from what Node hands back.
- `HttpServer`: `createNodeServer` and `createMemoryServer`, checked by
  `src/server/http-server.suite.ts`. The double keeps its own book of bound ports, so a flow that
  binds the same port twice fails there exactly as it would against a real socket.

Binding one implementation looks like this:

```ts
import { createFakeClient, HttpClientPort, okResponse } from "@venn-lang/http";

const ports = [
  {
    port: HttpClientPort,
    impl: createFakeClient({
      responses: { "https://api.test/health": okResponse({ status: 200 }) },
    }),
  },
];
```

A socket that refuses to bind is translated at the producer: `EADDRINUSE` becomes `VN7020`, anything
else `VN7021`. No caller ever reads a `node:net` errno.

## See also

- [`@venn-lang/sdk`](../sdk) for `definePlugin`, `defineAction` and `defineMatcher`.
- [`@venn-lang/stdlib`](../stdlib) for the plugin list and the default port bindings.
- [`@venn-lang/ws`](../std-ws) and [`@venn-lang/mqtt`](../std-mqtt), the other two network plugins.
