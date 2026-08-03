# Venn for VS Code

Language support for `.vn` files, backed by the Venn language server that your
project already runs on. See [Which version answers](#which-version-answers).

- **Diagnostics**: syntax errors (`VN1xxx`) and name resolution: unknown action
  `VN2003`, unknown matcher `VN2004`, unknown fragment `VN2005`.
- **Semantic highlighting**: the namespace of `http.get` is coloured apart from
  the action, matchers differ from actions, stdlib symbols are marked as library.
  A TextMate grammar colours the file instantly; the server then refines it with
  what only a resolver can know (§21: "a TextMate grammar is only a fallback
  while the server has not answered, so there are never two descriptions to keep in step).
- **Hover**: action signature, docs, options and owning package; matchers;
  fragment signatures; what a binding holds; what each annotation means.
- **Go to definition**: `run <fragment>`, variables, and imported files
  (including `#alias/…` paths from `venn.toml`).
- **Completion**: actions after `namespace.`, matchers after an `expect`
  subject, fragments after `run`, annotations after `@`, packages inside `import`.
- **Rename (F2)**, **signature help**, **formatting**, and the **outline**.

## Which version answers

The extension carries no compiler. It asks the toolchain for the server the
same way `venn` asks for the compiler, so a folder pinned to `0.2.0` is
underlined by `0.2.0` and the editor agrees with what `venn check` prints. An
editor that disagrees with the command line is worse than one that says
nothing, because there is no way to tell which of the two is right.

Which version that is comes from the folder: `venn.toml`, or `.venn-version`,
or the newest installed if neither asks for one. Change the pin and the server
restarts on the version you moved to, without reloading the window. Each
folder in a multi-root workspace gets its own.

If the pinned version is not installed, the *Venn* output channel says which
command installs it. Nothing is downloaded on your behalf: fetching a compiler
is not a decision an editor should take while you are typing.

So this needs `venn` on your machine:

```bash
npm install -g @venn-lang/venn
```

## Install from this repository

```bash
pnpm vscode:install     # build, package a .vsix, install it into your VS Code
```

Then reload the window: `Ctrl+Shift+P` → *Developer: Reload Window*.

Re-run the same command to update after changing the language or the server.
`pnpm vscode:uninstall` removes it.

Requires the `code` CLI on your PATH. If it is missing, run `Ctrl+Shift+P` →
*Shell Command: Install 'code' command in PATH* once.

> Copying the folder into `~/.vscode/extensions` does **not** work: VS Code keeps
> its own index (`extensions.json`) and ignores folders it has not registered.
> That is why the install goes through a `.vsix` and the `code` CLI.

## Check that it is working

Open any `.vn` file. The status bar (bottom right) should read **Venn**
instead of *Plain Text*. If it does not, the extension did not load. Check
`Ctrl+Shift+P` → *Developer: Show Running Extensions*.

## Formatting

Format on save is on by default for `.vn` files, because the extension ships these
defaults, which you can override per workspace:

```jsonc
"[venn]": {
  "editor.defaultFormatter": "venn.venn",
  "editor.formatOnSave": true,
  "editor.tabSize": 2
}
```

The project's own rules live in `venn.toml`, and the editor obeys them, so the
editor and `venn fmt` produce identical output:

```toml
[format]
indent = 2        # spaces per level
tabs = false      # indent with tabs instead
organize = true   # every `import` in one block
sort = false      # sort each group alphabetically
```

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `venn.trace.server` | `off` | Trace LSP traffic in the *Venn* output channel (`messages` or `verbose`). |
