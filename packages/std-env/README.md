# @venn/env

> The `env` namespace: the variables `venn.toml` declares, read as `env.NAME`.

This plugin contributes no verbs. `env.NAME` is a read, not a call. What it contributes is the name
itself, so a file that reads configuration has to say so with `use`, exactly like one that makes a
request or an assertion. The reader should never have to know which names are magic.

## Install

`@venn/env` is part of the stdlib the `venn` CLI and the language server load, so there is nothing
to install. A file that reads configuration says so:

```ruby
use "@venn/env"
```

## Usage

```toml
# venn.toml
[env.local]
BASE = "http://localhost:3000"

[env.staging]
BASE = "https://staging.example.com"
```

```ruby
# config.vn
module demo.config

use "@venn/assert"
use "@venn/env"

flow "Config" {
  step "reads the selected environment" {
    log "base=${env.BASE} env=${env.name}"
    expect env.name oneOf ["local", "staging"]
  }
}
```

```bash
venn test config.vn --env staging
```

`--env` selects the environment and defaults to `local`. Both `venn run` and `venn test` accept it.

## Names

| Name | Where it comes from |
| --- | --- |
| `env.name` | The environment that was selected. Always present, whatever the manifest declares. |
| `env.ANYTHING_ELSE` | The `[env.<name>]` table of `venn.toml`, a dotenv file, or the real process environment. |

Values come from three places, lowest precedence first:

1. `[env.<name>]` in `venn.toml`: the documented default, committed to the repository.
2. The dotenv files, in order: `.env`, `.env.<name>`, `.env.local`, `.env.<name>.local`, or whatever
   `[env] files` lists instead.
3. The environment the process was started with.

The real environment wins, because that is how CI passes a token in, and a value set on the command
line should never lose to a file in the repository. It overrides rather than adds: a name has to be
declared in one of the first two places for the third to fill it. That is what keeps `PATH` and
`TEMP` out of the editor's completion, and what stops a typo silently reading something off the
machine. A value that exists only in CI and is never declared is read through `secrets.*`, which
needs no declaration and redacts what it returns.

## Diagnostics

`env.KEYCLOAK_URL` used to resolve to nothing at all: a typo produced an empty string and a puzzling
404 rather than an error. Every `env.*` read is now checked against what the manifest declares,
including reads written inside a `"${…}"` placeholder.

| Code | When |
| --- | --- |
| `VN2007` | `env.*` is read in a file that never wrote `use "@venn/env"`. |
| `VN2006` | The name is not declared in `venn.toml`. The nearest declared name is offered: `"env.BAES" is not declared in venn.toml, did you mean "env.BASE"?` |

Nothing is reported when the manifest could not be read at all: a wrong error about a variable that
does exist is worse than no error.

## API

| Export | What it is |
| --- | --- |
| `envPlugin` (also the default export) | The `PluginDefinition`: namespace `env` and nothing else. No actions, no matchers, no `typeDefs`, no required capability. |

The namespace is deliberately empty. The values are the strings `venn.toml` declares, and the check
above, not a type, is what catches `env.TPYO`.

## See also

- [`@venn/cli`](../cli) for `--env`, the manifest and the dotenv files it reads.
- [`@venn/runtime`](../runtime) for the check that produces `VN2006` and `VN2007`.
- [`@venn/assert`](../std-assert) for the matchers used beside a configuration read.
