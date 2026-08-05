# @venn-lang/db

> The `db` namespace: seed tables, run statements and snapshot state, all through the `DbClient` port.

A flow that talks to a database needs the rows to be there before the first assertion and gone
after the last. This package gives six verbs for that, and puts every one of them behind a typed
port so the same flow runs against in-memory tables or a real connection without a line changing.

## Install

The package is part of the stdlib the `venn` CLI loads, so nothing to install. Reach it from a
flow with an `import` line:

```ruby
import { db } from "venn/db"
```

The plugin declares the `net` capability. A host that does not offer it fails the load with a
readable diagnostic rather than a `TypeError` mid-run.

## Usage

```ruby
module demo.orders

import { assert } from "venn/assert"
import { db } from "venn/db"

flow "Orders survive a snapshot" {
  step "seed the tables" {
    const loaded = db.seed { users: [{ id: 1, name: "Ada" }, { id: 2, name: "Grace" }] }
    expect loaded == 2
  }

  step "query them back" {
    const rows = db.query "SELECT * FROM users"
    expect rows.len == 2

    const grace = db.query "SELECT * FROM users" { where: { id: 2 } }
    expect grace[0].name == "Grace"
  }

  step "a snapshot undoes a mutation" {
    const before = db.snapshot
    const cleared = db.exec "TRUNCATE users"
    expect cleared == 2

    db.restore before
    const rows = db.query "SELECT * FROM users"
    expect rows.len == 2
  }
}
```

## Verbs

| Verb | Options | Gives back |
| --- | --- | --- |
| `db.connect url` | none | The URL it connected to, as a string. |
| `db.query sql` | `where` (a row of column to value) | `list<db.Row>`, the matching rows. |
| `db.exec sql` | `rows` (the rows an INSERT carries) | `number`, how many rows were affected. |
| `db.seed tables` | none | `number`, how many rows were loaded. |
| `db.snapshot` | none | `db.Tables`, a copy of the current state. |
| `db.restore snapshot` | none | nothing. |

The statement is always the positional argument; everything else is an option in the trailing
map. `db.seed` accepts the tables either positionally or written inline as options, so
`db.seed { users: [...] }` and `db.seed baseline` both work.

Two named types are published: `db.Row` (a map of column name to value) and `db.Tables` (rows
grouped by table name, which is what `db.seed` takes and `db.snapshot` gives back).

## The DbClient port

`venn.port.db-client`, contract version 1, requires `net`, six methods: `connect`, `query`,
`exec`, `seed`, `snapshot`, `restore`. Actions reach it with `ctx.port(DbClientPort)`, so nothing
in this package imports a driver.

Two implementations ship, and both answer the same conformance suite:

| Implementation | Behaviour |
| --- | --- |
| `createFakeDbClient({ tables })` | In-memory tables. Deterministic, offline, seedable. This is what the stdlib binds by default. |
| `createRealDbClient()` | A stub in this build. Every method throws a `VennError` with code `VN8090` rather than failing quietly. |

The fake carries a deliberately small query engine: `query` reads the table named after `FROM`
and filters by equality on each key of `where`; `exec` appends `rows` for `INSERT INTO` and clears
the table for `TRUNCATE` or `DELETE FROM`, returning the affected count. `snapshot` does a
structural clone, so restoring never aliases live state.

## API

| Export | What it is |
| --- | --- |
| `dbPlugin` (also the default export) | The `PluginDefinition` for the `db` namespace. |
| `DbClientPort` | The port descriptor. |
| `DbClient` | The interface an implementation satisfies. |
| `createFakeDbClient`, `createRealDbClient` | The two implementations. |
| `QueryArgs`, `ExecArgs` | The argument objects `query` and `exec` take. |
| `TableMap`, `SeedData`, `DbSnapshot` | Rows keyed by table name. The last two are aliases of the first, named for where they are used. |
| `Row`, `RowSchema` | The nominal row type, and the Zod schema `db.query` and `db.exec` validate their own options against. |
| `dbTypeDefs` | The `db.Row` and `db.Tables` specs the checker and the editor read. |

## Adding an implementation

Write the file, add one line to `src/clients/index.ts`, and add one line to
`src/clients/db-client.test.ts` calling `dbClientConformance` with it. The suite is not rewritten;
if the new client passes it, the verbs above already work against it.

## See also

- [`@venn-lang/data`](../std-data) for the deterministic rows to seed with.
- [`@venn-lang/contracts`](../contracts) for `Port`, `Host` and capability negotiation.
- [`@venn-lang/stdlib`](../stdlib) for the list of plugins and the port bindings the CLI runs with.
