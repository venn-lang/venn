import { type ExtensionContext, window, workspace } from "vscode";
import { Clients } from "./clients.js";
import { connect } from "./connect.js";
import { serverFor } from "./find-server.js";

/** What a folder pins its version in, either of which changes which server runs. */
const PINS = "**/{venn.toml,.venn-version}";

let clients: Clients | undefined;

/**
 * Starts a language server for each workspace folder, on the version that
 * folder asked for.
 *
 * Nothing is bundled. The server comes from where `venn` keeps its versions,
 * so the editor underlines what `venn check` would report. An editor that
 * disagrees with the command line is worse than one that says nothing, since
 * there is no way to tell which of them is right.
 */
export function activate(context: ExtensionContext): void {
  const log = window.createOutputChannel("Venn");
  const started = new Clients({
    find: serverFor,
    connect,
    say: (line) => log.appendLine(line),
  });
  clients = started;
  context.subscriptions.push(log);

  for (const folder of workspace.workspaceFolders ?? []) void started.open(folder);

  context.subscriptions.push(
    workspace.onDidChangeWorkspaceFolders((event) => {
      for (const folder of event.added) void started.open(folder);
      for (const folder of event.removed) void started.close(folder);
    }),
  );

  watchPins(context, started);
}

/**
 * A pin changed, so the folder may want a different version now.
 *
 * Restarting on the file rather than waiting for a reload: editing
 * `.venn-version` and then wondering why the editor still disagrees with the
 * command line is the whole problem this was meant to end.
 */
function watchPins(context: ExtensionContext, clients: Clients): void {
  const watcher = workspace.createFileSystemWatcher(PINS);
  const reopen = (): void => {
    for (const folder of workspace.workspaceFolders ?? []) void clients.open(folder);
  };
  watcher.onDidChange(reopen);
  watcher.onDidCreate(reopen);
  watcher.onDidDelete(reopen);
  context.subscriptions.push(watcher);
}

export function deactivate(): Promise<void> | undefined {
  return clients?.closeAll();
}
