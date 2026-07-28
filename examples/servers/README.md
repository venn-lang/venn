# Servers

Venn can start a real HTTP server and talk to it from the same file. These five examples build that
up: a handler that answers, routing, JSON in both directions, and a test that stands a server up,
asserts against it and gives the socket back.

| file | what it shows |
| --- | --- |
| [`01-hello.vn`](01-hello.vn) | `http.serve` on a free port, one handler, one request, then close |
| [`02-routing.vn`](02-routing.vn) | one handler routing on method and path, with statuses and headers |
| [`03-json-body.vn`](03-json-body.vn) | a JSON request body parsed in the handler, a JSON reply read as `res.json` |
| [`04-flow-against-it.vn`](04-flow-against-it.vn) | a test that starts the server, asserts the answer, and closes it with `defer` |
| [`05-stub-upstream.vn`](05-stub-upstream.vn) | the server as a stub third party: failure paths, and a table of cases |

Run them with:

```bash
venn run examples/servers/01-hello.vn
venn run examples/servers/02-routing.vn
venn run examples/servers/03-json-body.vn
venn test examples/servers/04-flow-against-it.vn
venn test examples/servers/05-stub-upstream.vn
```

The first three are programs, so `venn run` executes their statements top to bottom. The last two
hold `flow` blocks, so they need `venn test`.

## What to know before reading them

**Always bind to port 0.** It asks the operating system for a free port, and `api.port` reads back
the one it got. A hard-coded port is a test that fails the day something else is listening.

**A program that serves is not finished when its file is.** That is the point of a server, so the
first three examples call `api.close()` when they are done. Leave that out and the program keeps
listening, which is right, but nothing will ever stop it.

**A test file closes the server with `defer`.** Top-level statements run once, before the flows, so
the server is up by the time the first step asks it anything, and a top-level `defer` runs on the
way out, after the last flow, whether the run passed or failed.

**Whatever the handler returns is the reply.** A map carrying `status`, `headers` or `body` is taken
at its word; anything else becomes the body of a `200`; returning nothing sends `204`. The handler
is an ordinary `fn`, so routing is an expression rather than a framework.

## Caveats

These are the only examples in the repository that use the network, and they only ever talk to
themselves on `127.0.0.1`. Nothing here reaches the internet.

There is no WebSocket example. `@venn-lang/ws` has connect, send, expect and close but no server verb,
and its real client is a stub in this build, so an echo could not be written as something that
actually runs.

Next: [`../testing`](../testing) for what a flow can assert, and
[`../clients`](../clients) for talking to a service you did not start.
