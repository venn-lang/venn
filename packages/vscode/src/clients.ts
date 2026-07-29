import type { WorkspaceFolder } from "vscode";
import type { Connect, Find, Say, Session } from "./clients.types.js";

/**
 * One language server per workspace folder, each on the version that folder
 * asked for.
 *
 * Two folders in one window can want two versions, and a server started for
 * one would give the other diagnostics from a compiler it does not use. Keyed
 * by folder so each gets its own, and so a folder can be restarted alone when
 * its pin changes.
 *
 * Finding and starting are handed in rather than reached for. When to restart
 * is the part worth getting right, and this way it can be watched without an
 * editor or a compiler anywhere near it.
 */
export class Clients {
  private readonly running = new Map<string, Session>();
  /** The version each folder is on, so a restart is skipped when it did not move. */
  private readonly versions = new Map<string, string>();

  constructor(private readonly on: { find: Find; connect: Connect; say: Say }) {}

  /** Starts the server for a folder, or replaces the one running if it moved. */
  async open(folder: WorkspaceFolder): Promise<void> {
    const found = await this.on.find(folder.uri.fsPath);
    if (found.kind === "missing") {
      this.on.say(`${folder.name}: ${found.reason}`);
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
    this.on.say(`${args.folder.name}: starting Venn ${args.version}`);
    const session = this.on.connect({ folder: args.folder, entry: args.entry });
    this.running.set(key, session);
    this.versions.set(key, args.version);
    await session.start();
  }

  /** Stops the server for a folder, if one is running. */
  async close(folder: WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    const session = this.running.get(key);
    this.running.delete(key);
    this.versions.delete(key);
    await session?.stop();
  }

  /** Stops every server, for when the extension itself is going away. */
  async closeAll(): Promise<void> {
    const running = [...this.running.values()];
    this.running.clear();
    this.versions.clear();
    await Promise.all(running.map((session) => session.stop()));
  }
}
