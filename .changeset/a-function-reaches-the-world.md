---
"@venn-lang/core": patch
"@venn-lang/runtime": patch
"@venn-lang/cli": patch
---

A `fn` reaches the world. `VN2024` is gone, and with it the rule that no
callback could do anything.

```venn
fn resumo(url) {
  const res = http.get(url)
  print "buscou ${url}"
  { status: res.status, bytes: res.body.len }
}
```

Every line of that was refused. So was `rows.map(r => http.get(r.url).status)`,
so was a handler that queries before it answers, and so was `print` inside a
function.

The rule read `PluginDefinition.requires`: a verb whose plugin asked the host
for a port could not be called from a pure body. It bought one thing, that a
graph drawn from a program shows everything the program reaches, and it cost the
whole category of higher-order functions over effects. A `fragment` could reach
the world and is not a value, so it could not be passed where a callback goes:
the way out the refusal offered did not exist. That is the trade, made the other
way round now, because a language whose interesting half cannot be written has
no graph worth drawing.

`fail` is unchanged. Raising is control flow rather than an effect, so the
compiler still builds it into the body instead of calling it: a raise leaves
before there is anything to bind. A step and an `expect` are still refused by the
grammar, because neither means anything without a `flow` around it.

Three things had to be true before the rule could go, and none of them were.

**Statements now run in order.** A compiled body evaluated its bindings all at
once and only waited where one was read, so this printed `0`:

```venn
fn probe() {
  const r = http.get(base)
  print "hits after the call: ${hits}"
  r.status
}
```

The call was still in flight when the line under it read the world. Bindings and
statements are settled before the one behind them now, in bodies, in loops, in a
`try` and in its `finally`, which no longer fires while a slow attempt is still
running. Nothing pays for it until something is actually slow: the check is one
comparison past the path an ordinary statement takes.

**A verb statement runs instead of raising.** `compileVerb` built a raise for
every verb, so with the check alone removed `print "x"` inside a `fn` failed with
the text it was asked to print. A verb is now the value its name resolves to,
called with the arguments after it, by the same path `io.print("x")` in an
expression already took. The prelude verbs `print`, `log`, `wait`, `skip` and
`exit` are bound as values in the root scope, which is how the engine already
crossed into a compiled body for every plugin namespace.

**Collection callbacks wait for what they answer.** Twenty-four of them dropped a
pending value on the floor, so `[1, 2].map(n => spawn(() => n * 10).wait)` gave
`[{}, {}]`. It gives `[10, 20]`. This one was broken before any of the rest and
had nothing to do with purity: it needed a callback that reaches something slow
before anybody could see it.

`known-gaps.md` entry 21 closes. Entry 22, a `fragment` that passes `venn check`
as a value and answers `null` at run time, rises to high: it was survivable while
a `fragment` was the only body that could reach the world, and now the only thing
one uniquely does is carry steps.
