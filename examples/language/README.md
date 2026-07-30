# Language

The language's own machinery: naming shapes, deciding between them, rewriting
declarations before they run, and splitting a program across files. For someone who has read `examples/basics/`
and wants to know what the kernel offers beyond statements.

| file | what it shows |
| --- | --- |
| [`01-types.vn`](01-types.vn) | `type X = A \| B`, record types, optional fields, `list<T>` and `map<V>`, annotated `fn` and bindings |
| [`02-decorators.vn`](02-decorators.vn) | `deco`, `target.wrap`, a decorator's own arguments, and what stacking two of them means |
| [`03-decorator-targets.vn`](03-decorator-targets.vn) | the first parameter's type is what the decorator may decorate, and the handle each kind hands over |
| [`04-modules.vn`](04-modules.vn) | `use` versus `import`, named and namespace imports, and why `pub` is opt-in |
| [`05-shared-alias.vn`](05-shared-alias.vn) | a `#shared` path alias out of `venn.toml`, and a `pub deco` applied across files |
| [`06-fragments.vn`](06-fragments.vn) | `fragment` as reusable steps, `run … as`, and what a fragment can and cannot see |
| [`07-unions.vn`](07-unions.vn) | a union told apart by a field, narrowing it with `if` and `?:`, and the cases the checker insists on |
| [`shared/`](shared) | the helpers the files above import: `pub fn`, `pub deco`, `pub fragment` |

Run them with:

```bash
venn run examples/language/01-types.vn
```

`06-fragments.vn` contains flows, so it is a test file rather than a program:

```bash
venn test examples/language/06-fragments.vn
```

Everything in `shared/` is a library. It has nothing to run; `venn check examples/language/`
covers it along with the rest.

Two things worth knowing before you read:

- **`#shared` is declared once**, in `examples/venn.toml`, as `"#shared" = "./language/shared"`.
  The alias is a property of the workspace, not of any one file.
- **Only `fn`, `fragment` and `deco` can be `pub`.** A `type` or a `const` stays in the file
  that declared it, so each of these files names the shapes it needs where it needs them.

Next: `examples/testing/` for what all of this is ultimately for.
