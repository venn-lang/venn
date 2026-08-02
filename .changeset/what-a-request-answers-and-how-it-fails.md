---
"@venn-lang/http": minor
---

`res.time` is how long the request took, and a request that failed says so in
the product's voice.

```venn
const res = http.get "${base}/health"
print "status ${res.status} in ${res.time}"
```

`time` was zero for every response, whatever the request had really cost, so
`expect res.time < 2s` passed forever and for the wrong reason. Both
implementations now measure the round trip on a monotonic clock, from the
request going out to the body being in hand, and neither reads the field off a
canned response: a number a test wrote by hand is the same bug wearing a
different hat. The double takes the time it says it takes, so a test about a
slow service gives it a `latency` and really waits it.

A request that never got an answer used to arrive as `fetch failed`, the name
of a JavaScript function, with no code to branch on and nothing said about what
was refused or by whom. It is now a `VennError`:

```
VN7022: Nothing is listening on 127.0.0.1:8080, so GET http://127.0.0.1:8080/health was refused.
VN7023: The name api.invalid did not resolve, so GET http://api.invalid/health had nowhere to go.
VN7024: GET http://10.255.255.1/health ran out of time after 11113ms without an answer.
```

The three are told apart because they ask for three different things: start the
service, fix the address, or wait longer. The double raises the same three, so a
flow's `catch` can be tested offline with
`createFakeClient({ failures: { url: "refused" } })`. A failure with no name of
its own is handed on untouched rather than dressed in a code that says something
specific and false, which is what keeps a `race` cancelling a request from
reading as a request that failed.
