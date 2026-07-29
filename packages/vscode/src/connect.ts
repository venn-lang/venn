import type { WorkspaceFolder } from "vscode";
import { LanguageClient, type ServerOptions, TransportKind } from "vscode-languageclient/node";
import type { Session } from "./clients.types.js";

/**
 * Starts the language client for a folder, scoped to it, so each server sees
 * only the documents it answers for.
 *
 * @param args The folder, and the server entry point to run for it.
 * @returns The client, as the pair of calls that starting and stopping needs.
 */
export function connect(args: { folder: WorkspaceFolder; entry: string }): Session {
  const server: ServerOptions = {
    run: { module: args.entry, transport: TransportKind.ipc },
    debug: {
      module: args.entry,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };
  return new LanguageClient("venn", "Venn", server, {
    documentSelector: [
      { scheme: "file", language: "venn", pattern: `${args.folder.uri.fsPath}/**` },
    ],
    workspaceFolder: args.folder,
  });
}
