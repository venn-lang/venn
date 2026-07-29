import type { OutputChannel, WorkspaceFolder } from "vscode";
import { LanguageClient, type ServerOptions, TransportKind } from "vscode-languageclient/node";
import { serverFor } from "./find-server.js";

/**
 * One language server per workspace folder, each on the version that folder
 * asked for.
 *
 * Two folders in one window can want two versions, and a server started for
 * one would give the other diagnostics from a compiler it does not use. Keyed
 * by folder so each gets its own, and so a folder can be restarted alone when
 * its pin changes.
 */
export class Clients {
  private readonly running = new Map<string, LanguageClient>();
  /** The version each folder is on, so a restart is skipped when it did not move. */
  private readonly versions = new Map<string, string>();

  constructor(private readonly log: OutputChannel) {}

  /** Starts the server for a folder, or replaces the one running if it moved. */
  async open(folder: WorkspaceFolder): Promise<void> {
    const found = await serverFor(folder.uri.fsPath);
    if (found.kind === "missing") {
      this.log.appendLine(`${folder.name}: ${found.reason}`);
      await this.close(folder);
      return;
    }
    if (this.versions.get(folder.uri.toString()) === found.version) return;
    await this.restart({ folder, entry: found.entry, version: found.version });
  }

  /**
   * The folder is on another version now, so the server it had answers for a
   * compiler it no longer uses. Stopped before the next one starts, since two
   * servers on one folder would each underline what the other does not.
   */
  private async restart(args: {
    folder: WorkspaceFolder;
    entry: string;
    version: string;
  }): Promise<void> {
    const key = args.folder.uri.toString();
    await this.close(args.folder);
    this.log.appendLine(`${args.folder.name}: starting Venn ${args.version}`);
    const client = clientFor({ folder: args.folder, entry: args.entry });
    this.running.set(key, client);
    this.versions.set(key, args.version);
    await client.start();
  }

  /** Stops the server for a folder, if one is running. */
  async close(folder: WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    const client = this.running.get(key);
    this.running.delete(key);
    this.versions.delete(key);
    await client?.stop();
  }

  /** Stops every server, for when the extension itself is going away. */
  async closeAll(): Promise<void> {
    const running = [...this.running.values()];
    this.running.clear();
    this.versions.clear();
    await Promise.all(running.map((client) => client.stop()));
  }
}

/** Scoped to its folder, so each server sees only the documents it answers for. */
function clientFor(args: { folder: WorkspaceFolder; entry: string }): LanguageClient {
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
