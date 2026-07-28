# @venn/lsp

> The Venn language server: diagnostics, hover, completion, definition, references, rename, signature help, semantic tokens, formatting, document highlight and quick fixes for `.vn` files.

Venn's grammar is deliberately tiny, so the parser alone cannot tell `http.get` from `myHelper.foo`. This package puts the missing knowledge back: it loads the whole stdlib, indexes every action, matcher and published type into a catalog, and serves that catalog to an editor over LSP. It is built on Langium and ships a standalone `venn-lsp` binary that any client can spawn.

## Usage

Run the server from a shell. With no transport flag it defaults to stdio, so a bare invocation works.

```bash
pnpm --filter @venn/lsp build
node packages/lsp/dist/bin/venn-lsp.mjs --stdio
```

To host it yourself, hand `startVennServer` a connection. This is the whole server entry point of the VS Code extension:

```ts
import { startVennServer } from "@venn/lsp";
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";

startVennServer(createConnection(ProposedFeatures.all));
```

To drive the providers directly (tests, a custom editor, a node graph UI), build the services and call them:

```ts
import { createVennLspServices } from "@venn/lsp";
import { EmptyFileSystem } from "langium";

const { shared, Venn } = createVennLspServices(EmptyFileSystem);
const hover = await Venn.lsp.HoverProvider?.getHoverContent(document, params);
```

`Venn` is a `VennServices`: Langium's own services plus `catalog`, `imports` and `types`.

## API

### Server and services

| Export | What it does |
| --- | --- |
| `startVennServer(connection)` | Builds the services on the node filesystem and starts the Langium language server. |
| `createVennLspServices(context)` | Returns `{ shared, Venn }`. Registers the Venn checks and keeps workspace types warm. |
| `VennServices`, `VennAddedServices` | The service types. `VennAddedServices` is `catalog`, `imports` and `types`. |
| `registerVennChecks(services)` | Wires the runtime's static check and type inference into Langium's validation registry. |

### Providers

Each is registered by `createVennLspServices`; export them for direct use or for a client that assembles its own module.

| Export | LSP request |
| --- | --- |
| `VennHoverProvider` | `textDocument/hover` |
| `VennCompletionProvider` | `textDocument/completion` |
| `VennDefinitionProvider` | `textDocument/definition` |
| `VennReferencesProvider` | `textDocument/references` |
| `VennDocumentHighlightProvider` | `textDocument/documentHighlight` |
| `VennRenameProvider` | `textDocument/rename`, `prepareRename` |
| `VennSignatureHelpProvider` | `textDocument/signatureHelp` |
| `VennSemanticTokenProvider` | `textDocument/semanticTokens` |
| `VennDocumentSymbolProvider` | `textDocument/documentSymbol` |
| `VennFormatter` | `formatting`, `rangeFormatting`, `onTypeFormatting` |

### Catalog

| Export | What it does |
| --- | --- |
| `buildCatalog(plugins)` | Indexes plugin definitions into a `SymbolCatalog`. |
| `SymbolCatalog` | Lookup and listing: `namespaces()`, `hasNamespace()`, `actionsIn()`, `action()`, `typesIn()`, `matchers()`, `matcher()`, `packagesFor()`, `namespaceOfPackage()`. |
| `ActionEntry`, `MatcherEntry` | One action or matcher, with the package that contributes it. |

### Documents and workspace

| Export | What it does |
| --- | --- |
| `createImportResolver()`, `ImportResolver` | Reads the nearest `venn.toml`: resolves a specifier, lists `[paths]` aliases, returns `[format]` settings, declared env vars and derived package types. |
| `resolveFragment(args)`, `FragmentLocation` | Finds a fragment in this file or through the `import` naming it. |
| `findFragment(document, name)` | The fragment a parsed document declares under that name. |
| `findBinding(from, name)` | The node that binds a name, searched outwards to the document. |
| `exportedNames(document)` | The names a module marks `pub`, each with its kind (`fragment`, `fn`, `deco`). |
| `importedNames(document)` | The names a document pulls in through `import { … }`. |

### Completion, decorators, docs, references

| Export | What it does |
| --- | --- |
| `contextAt(text)`, `CompletionContext` | Classifies the cursor from the text before it: `package`, `modulePath`, `importName`, `action`, `member`, `annotation`, `fragment`, `matcher`, `optionKey`, `argument`, `typeName`, `statement`. |
| `modulePaths(args)` | What may follow `from "`: sibling `.vn` files, or a `#alias/…` path from `venn.toml`. |
| `decosInScope(scope)`, `decoNamed(name, scope)`, `builtinDecos()` | Every decorator a `@name` could mean here: built-ins, imported `pub deco`s, and the file's own. Later wins. |
| `DecoInfo`, `DecoScope` | A decorator's name, signature, what it decorates, and where it is declared. |
| `parseDoc(lines)`, `readDoc(document, node)`, `renderDoc(doc)` | Read and render a documentation block. |
| `DocBlock`, `DocParam` | Summary, params, returns, examples, deprecated. |
| `symbolAt(document, position)` | What a position names: a `fragment`, `deco`, `fn`, `type`, `binding` or `external` name. |
| `occurrencesIn(args)` | Every place one symbol appears in one document. |
| `findOccurrences(args)` | The same across the workspace, but only for symbols that cross files. |

## What the server answers

| Feature | Behaviour |
| --- | --- |
| **Diagnostics** | Syntax errors (`VN1xxx`), then the same static check `venn check` runs: `VN2003` unknown action, `VN2004` unknown matcher, `VN2005` unknown fragment, `VN2006` an `env` var no `venn.toml` declares, `VN2007` a namespace used without a `use`, `VN2008` a verb read as a value, `VN2009` a name the imported module does not publish, plus type errors (`VN3xxx`) and lint (`VN5xxx`). |
| **Hover** | Action signature, docs, options and owning package; matchers; fragment signatures; what a `let` or a parameter binds; what a package contributes; what an annotation means; what an `env` variable holds. Inside `"${…}"` the name hovers as code, not as text. |
| **Completion** | Verbs and published types after `namespace.`, members after any other dot, matchers once `expect` has a subject, fragments after `run`, decorators after `@`, packages inside `use "…"`, module paths after `from "`, published names inside `import { … }`, option keys inside a call's `{ … }`, type names after a `:`, and the names in scope anywhere else. |
| **Go to definition** | `run <fragment>` lands on the declaration, following an `import` into another file; a name lands on the statement that binds it; a `@deco` lands on the `deco` that declares it; an import specifier opens the file. |
| **References and highlight** | Both read one occurrence walk, so they agree with rename. A `fragment`, `fn` or `deco` is searched across the workspace; a `binding` or a `type` stays in its file, because a `const` of the same name next door is a different name. Highlight marks the declaration as a write and each use as a read. |
| **Rename** | Rewrites exactly what "find all references" reports, including the names inside `import { … }`. A built-in decorator has no source to rewrite, so rename declines it. |
| **Signature help** | Space is a trigger character alongside `(` and `,`, because a Venn call needs no brackets: `http.on ` already has an argument due. The options map counts as the last parameter. |
| **Semantic tokens** | The namespace of `http.get` is coloured apart from the verb, a matcher is a `method`, an annotation is a `decorator`, a `run` target is a `macro`, and anything the catalog knows carries the `defaultLibrary` modifier. |
| **Outline** | Flows with their nested steps and groups, plus fragments and `deco` declarations. |
| **Formatting** | Runs through `formatText` in `@venn/core`, so the editor and `venn fmt` produce byte-identical output. `[format]` in `venn.toml` wins; the editor's indent settings fill in the rest. On-type formatting triggers on `}` and newline. |
| **Quick fixes** | `VN2007` offers `Add use "<pkg>"` for every package providing the namespace, inserted above the imports. `VN2005` offers `Import <name> from "…"` for every module that publishes it. `VN5001` replaces `capture` with `let`. |

## Documenting a declaration

A run of `##` lines directly above a declaration is its documentation. The body is markdown, and four tags are understood: `@param`, `@returns`, `@example`, `@deprecated`.

```ruby
## Signs a user in through the API and asserts the session is live.
##
## @param user  The account name to sign in as.
## @returns The HTTP response of the sign-in call.
## @example
## run login("alice")
pub fragment login(user) {
  step "in" { expect true }
}
```

A single `#` stays an ordinary comment. The `@doc("…")` annotation works too and is used when no `##` block is present. Hovering `run login(…)` shows the block even when the fragment lives in another file: the server follows the `import`, `#alias/…` paths included.

## Editors

**VS Code.** The client extension is in [`packages/vscode`](../vscode). It bundles this server and spawns it over IPC. From the repo root:

```bash
pnpm vscode:install     # build, package a .vsix, install it
pnpm vscode:uninstall
```

Reload the window afterwards. This needs the `code` CLI on your PATH.

**Any other client.** Point it at the binary and claim the `.vn` extension. For Neovim:

```lua
vim.filetype.add({ extension = { vn = "venn" } })
vim.lsp.config.venn = {
  cmd = { "node", "/abs/path/packages/lsp/dist/bin/venn-lsp.mjs", "--stdio" },
  filetypes = { "venn" },
  root_markers = { "venn.toml", ".git" },
}
vim.lsp.enable("venn")
```

## Notes

- Every namespace resolves regardless of which `use` lines a file has, because the server loads the whole stdlib. A missing `use` is reported as `VN2007` rather than as an unknown action.
- Type inference is cached per parse in a shared `TypeService`, so diagnostics and hover read the same result and a keystroke re-checks only the edited file.
- Import specifiers resolve like the CLI's: relative paths against the importing file, `#alias/…` through `[paths]` in the nearest `venn.toml`, searched upwards and cached per directory.
- Cross-file rename reaches every document the server has indexed. A file it has never opened or scanned is not rewritten.

## See also

- [`@venn/core`](../core) for the grammar, the AST, type inference and the formatter.
- [`@venn/runtime`](../runtime) for the static check and the plugin registry the diagnostics use.
- [`@venn/stdlib`](../stdlib) for the plugins the catalog indexes.
- [`packages/vscode`](../vscode) for the client that ships this server.
