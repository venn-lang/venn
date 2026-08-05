---
"@venn-lang/cli": patch
---

`pnpm vscode:install` works again.

The documented way to install the editor extension refused to run:

```
ERROR  @types/vscode 1.125.0 greater than engines.vscode ^1.90.0.
Either upgrade engines.vscode or use an older @types/vscode version
```

`vsce` will not package an extension typed against an editor newer than the one
its `engines` claims to support, and the rule is right: the types have to
describe the **oldest** editor the extension runs on, or it can be written
against an API that version does not have and the failure lands on somebody
else's machine.

So the types came down to `1.90.0` rather than the engine going up. The
extension uses four APIs, `window.createOutputChannel`,
`workspace.createFileSystemWatcher`, `workspace.onDidChangeWorkspaceFolders` and
`workspace.workspaceFolders`, all of them older than 1.90, which `tsc` confirms
rather than a reading of the source.

A test pins the two together. It is in the package rather than in the packaging
step, because that step only runs when somebody is already trying to install.
